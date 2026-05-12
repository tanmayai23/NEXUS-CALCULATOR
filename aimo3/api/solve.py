#!/usr/bin/env python
"""
NEXUS CALCULATOR - Deterministic CAS solver
===========================================

Called by the Node.js backend (`POST /api/solve/auto`, `POST /api/aimo3/solve`).

Design goals:
  * Deterministically correct for the bulk of class 9-12 mathematics
    (arithmetic, algebra, equation solving, calculus, matrices, stats,
    probability, mensuration helpers) using SymPy.
  * Grounds every answer in the NCERT curriculum (chapter + formula) via the
    lightweight knowledge index in aimo3/api/knowledge.py.
  * Always prints exactly one line of JSON on stdout, even on failure, so the
    backend contract { answer, solution, confidence } never breaks.

Standalone usage:
    python solve.py --problem "solve x^2 - 5x + 6 = 0"
"""

import sys
import os
import re
import json
import math
import argparse

# Make both aimo3/api/ and aimo3/ importable (so the knowledge module loads
# whether solve.py is run as a script or imported as part of the `api` package).
_HERE = os.path.dirname(os.path.abspath(__file__))
_AIMO3_DIR = os.path.dirname(_HERE)
for _p in (_HERE, _AIMO3_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ---------------------------------------------------------------------------
# Optional knowledge retrieval (NCERT chapter + formula grounding).
# ---------------------------------------------------------------------------
try:
    import knowledge as _knowledge  # type: ignore  (aimo3/api on sys.path)
except Exception:  # pragma: no cover - knowledge layer is best-effort
    _knowledge = None


def _retrieve_context(question: str) -> dict:
    if _knowledge is None:
        return {}
    try:
        ctx = _knowledge.retrieve(question) or {}
    except Exception:
        return {}
    # Only trust reasonably confident text matches; weak ones would surface a
    # misleading chapter. (Deterministic method->chapter mapping handles the
    # common computational cases separately - see _METHOD_TO_CHAPTER.)
    if float(ctx.get("score", 0)) < 0.5:
        return {}
    return ctx


# Deterministic mapping from solver method -> (NCERT grade, chapter name).
# Used to attach the correct chapter to computational answers without relying
# on noisy text retrieval.
_METHOD_TO_CHAPTER = {
    "herons-formula": (9, "Heron's Formula"),
    "arithmetic-progression": (10, "Arithmetic Progressions"),
    "permutations-combinations": (11, "Permutations and Combinations"),
    "number-theory": (10, "Real Numbers"),
    "statistics": (10, "Statistics"),
    "linear-system": (10, "Pair of Linear Equations in Two Variables"),
    "quadratic-equation": (10, "Quadratic Equations"),
    "circle-mensuration": (10, "Areas Related to Circles"),
    "mensuration": (9, "Surface Areas and Volumes"),
    "factor": (9, "Polynomials"),
    "expand": (9, "Polynomials"),
    "polynomial-roots": (10, "Polynomials"),
    "derivative": (12, "Continuity and Differentiability"),
    "indefinite-integral": (12, "Integrals"),
    "definite-integral": (12, "Integrals"),
    "limit": (11, "Limits and Derivatives"),
    "determinant": (12, "Determinants"),
    "matrix-inverse": (12, "Matrices"),
    "matrix": (12, "Matrices"),
}


def _context_for(method: str, question: str) -> dict:
    chap = _METHOD_TO_CHAPTER.get(method)
    if chap is not None and _knowledge is not None:
        try:
            ch = _knowledge.lookup_chapter(grade=chap[0], name=chap[1])
        except Exception:
            ch = None
        if ch:
            return {
                "grade": ch.get("grade"),
                "chapter": ch.get("chapter"),
                "question_types": ch.get("question_types", []),
                "relevant_formulas": ch.get("formulas", [])[:3],
            }
        return {"grade": chap[0], "chapter": chap[1]}
    return _retrieve_context(question)


# ---------------------------------------------------------------------------
# SymPy import. If SymPy is missing we degrade to a tiny arithmetic fallback
# rather than crash.
# ---------------------------------------------------------------------------
try:
    import sympy as sp
    from sympy import (
        Symbol, symbols, Eq, sympify, simplify, expand, factor, diff,
        integrate, limit, Matrix, solve as sp_solve, oo, pi, E, S, nsimplify,
        Rational, sqrt as sp_sqrt,
    )
    from sympy.parsing.sympy_parser import (
        parse_expr, standard_transformations,
        implicit_multiplication_application, convert_xor,
    )
    _SYMPY_OK = True
    _TRANSFORMS = standard_transformations + (
        implicit_multiplication_application, convert_xor,
    )
except Exception:  # pragma: no cover
    _SYMPY_OK = False


# ---------------------------------------------------------------------------
# Input cleaning
# ---------------------------------------------------------------------------
_SUPERSCRIPTS = {
    "²": "**2", "³": "**3", "⁰": "**0", "¹": "**1",
    "⁴": "**4", "⁵": "**5", "⁶": "**6", "⁷": "**7",
    "⁸": "**8", "⁹": "**9",
}

_LEAD_PHRASES = [
    r"^\s*(please\s+)?(can you\s+|could you\s+|kindly\s+)?",
    r"^\s*solve\s+for\s+[a-z]\s*[:\-]?\s*",
    r"^\s*(find|calculate|compute|evaluate|determine|work out|simplify|solve|"
    r"factor(ize|ise)?|expand|differentiate|integrate)\b[:\- ]*",
    r"^\s*what\s+(is|are|will be)\b[:\- ]*",
    r"^\s*the\s+value\s+of\b[:\- ]*",
    r"^\s*the\s+(zeroes|zeros|roots)\s+of\b[:\- ]*",
    r"^\s*for\s+[a-z]\s*[:\-]?\s*",
]


def _clean_math(text: str) -> str:
    """Normalise a raw math snippet to something SymPy can parse."""
    s = text.strip()
    # Strip LaTeX delimiters / dollar signs.
    s = s.replace("$", " ").replace("\\(", " ").replace("\\)", " ")
    s = s.replace("\\[", " ").replace("\\]", " ").replace("\\,", " ")
    # LaTeX commands.
    s = re.sub(r"\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}", r"((\1)/(\2))", s)
    s = re.sub(r"\\sqrt\s*\{([^{}]*)\}", r"sqrt(\1)", s)
    s = re.sub(r"\\sqrt\s*([0-9a-zA-Z]+)", r"sqrt(\1)", s)
    s = s.replace("\\times", "*").replace("\\cdot", "*").replace("\\div", "/")
    s = s.replace("\\left", "").replace("\\right", "")
    s = re.sub(r"\\pi\b", "pi", s)
    s = re.sub(r"\\?infty\b", "oo", s)
    s = re.sub(r"\\[a-zA-Z]+", " ", s)  # drop remaining LaTeX commands
    # Unicode operators.
    s = (s.replace("×", "*").replace("⋅", "*").replace("·", "*")
           .replace("÷", "/").replace("−", "-")
           .replace("√", "sqrt").replace("∞", "oo")
           .replace("π", "pi"))
    for k, v in _SUPERSCRIPTS.items():
        s = s.replace(k, v)
    # `^` handled by convert_xor transform, but normalise spacing.
    s = re.sub(r"\s+", " ", s).strip()
    # Percent (school context: '%' always means percent, never modulo).
    #   "15% of 200" / "15% 200"  ->  "(15/100)*200"
    #   bare "50%"                 ->  "(50/100)"
    s = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*of\b\s*", r"(\1/100)*", s, flags=re.I)
    s = re.sub(r"(\d+(?:\.\d+)?)\s*%\s*(?=[\d(])", r"(\1/100)*", s)
    s = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"(\1/100)", s)
    return s


# Words that are never part of a math expression but commonly appear in the
# surrounding prose. Stripped before parsing so SymPy never sees "the", "of",
# etc. (which implicit-multiplication would otherwise read as `t*h*e` ...).
# Only words that NEVER occur inside a real math expression. (Notably NOT "to"
# or "for" - "from a to b" / "solve for x" are handled elsewhere and "to" as a
# bare token must survive for definite-integral bound parsing.)
_FILLER = re.compile(
    r"\b(the|of|value|values|please|kindly|find|calculate|compute|evaluate|"
    r"determine|following|expression|equations?|system|answer)\b", re.I,
)

# Alphabetic tokens that ARE legitimate inside an expression (SymPy functions
# and common symbol names). Anything else of length >= 4 hints at prose.
_KNOWN_MATH_WORDS = {
    "sqrt", "cbrt", "root", "sin", "cos", "tan", "cot", "sec", "csc",
    "sinh", "cosh", "tanh", "asin", "acos", "atan", "acot", "asec", "acsc",
    "exp", "log", "ln", "abs", "sign", "floor", "ceiling", "ceil", "frac",
    "factorial", "gamma", "binomial", "max", "min", "mod", "gcd", "lcm",
    "matrix", "transpose", "det", "rational", "real", "complex", "conjugate",
    "pi", "oo", "infinity", "inf", "nan", "eulergamma",
    "theta", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "rho", "sigma",
    "tau", "upsilon", "phi", "chi", "psi", "omega", "varphi", "vartheta",
}


def _looks_like_prose(text: str) -> bool:
    words = [w.lower() for w in re.findall(r"[A-Za-z]{4,}", text or "")]
    unknown = [w for w in words if w not in _KNOWN_MATH_WORDS]
    return len(unknown) >= 2


def _strip_filler(text: str) -> str:
    return re.sub(r"\s+", " ", _FILLER.sub(" ", text or "")).strip()


def _strip_lead(question: str) -> str:
    q = question.strip().rstrip("?").strip()
    for pat in _LEAD_PHRASES:
        q = re.sub(pat, "", q, flags=re.I)
    return _strip_filler(q)


def _parse(expr_text: str):
    """Parse a cleaned expression string into a SymPy object."""
    cleaned = _clean_math(expr_text)
    try:
        return parse_expr(cleaned, transformations=_TRANSFORMS, evaluate=True)
    except Exception:
        # Last-ditch: replace ^ manually then sympify.
        return sympify(cleaned.replace("^", "**"))


def _free_symbol(expr):
    """Pick a sensible single variable for solving/calculus."""
    syms = sorted(expr.free_symbols, key=lambda x: x.name)
    if not syms:
        return Symbol("x")
    for pref in ("x", "y", "t", "n", "a"):
        for sym in syms:
            if sym.name == pref:
                return sym
    return syms[0]


def _fmt(obj) -> str:
    try:
        if isinstance(obj, Matrix):
            return "[" + ", ".join(
                "[" + ", ".join(_fmt(obj[i, j]) for j in range(obj.cols)) + "]"
                for i in range(obj.rows)
            ) + "]"
        return sp.sstr(obj)
    except Exception:
        return str(obj)


def _num(obj):
    """Return a JSON-friendly numeric value when the result is a plain number."""
    try:
        if obj.free_symbols:
            return None
        val = obj.evalf()
        if val.is_real:
            f = float(val)
            if abs(f - round(f)) < 1e-9:
                return int(round(f))
            return round(f, 8)
    except Exception:
        pass
    return None


def _answer_value(obj):
    """Best JSON value for `answer`:
      * integers  -> int
      * clean rationals (5/6) and irrationals (3*sqrt(2), pi, E) -> exact string
      * floats / other evalf-able numbers -> rounded decimal
      * expressions with variables -> their string form
    """
    try:
        if obj.free_symbols:
            return _fmt(obj)
    except Exception:
        return str(obj)
    try:
        if getattr(obj, "is_Integer", False):
            return int(obj)
        if getattr(obj, "is_Rational", False):
            return _fmt(obj)
        if getattr(obj, "is_Float", False):
            f = float(obj)
            return int(round(f)) if abs(f - round(f)) < 1e-9 else round(f, 8)
        if getattr(obj, "is_number", False):
            # Irrational / constant: keep the exact symbolic form.
            return _fmt(sp.simplify(obj))
        val = obj.evalf()
        f = float(val)
        return int(round(f)) if abs(f - round(f)) < 1e-9 else round(f, 8)
    except Exception:
        return _fmt(obj)


def _decimal_of(obj):
    """Best-effort decimal string for a numeric SymPy object, else None."""
    try:
        if obj.free_symbols:
            return None
        f = float(obj.evalf())
        return int(f) if abs(f - round(f)) < 1e-9 else round(f, 8)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Result helper
# ---------------------------------------------------------------------------
def _result(answer, steps, confidence, method, question, ctx=None):
    if ctx is None:
        ctx = _context_for(method, question)
    formulas = (ctx or {}).get("relevant_formulas") or (ctx or {}).get("formulas") or []
    formulas = formulas[:3]
    sol_lines = list(steps)
    if formulas:
        sol_lines.append("NCERT formula(s): " + "; ".join(formulas))
    out = {
        "answer": answer,
        "solution": "\n".join(str(x) for x in sol_lines if str(x).strip()),
        "steps": [str(x) for x in steps if str(x).strip()],
        "confidence": round(float(confidence), 2),
        "method": method,
    }
    if (ctx or {}).get("chapter"):
        out["chapter"] = ctx["chapter"]
    if (ctx or {}).get("grade"):
        out["grade"] = ctx["grade"]
    if formulas:
        out["relevant_formulas"] = formulas
    return out


def _fail(question, note="Could not solve this with the deterministic engine."):
    ctx = _retrieve_context(question)
    formulas = (ctx.get("relevant_formulas") or ctx.get("formulas") or [])[:3]
    if formulas:
        return {
            "answer": "See NCERT formula(s): " + "; ".join(formulas),
            "solution": "\n".join([
                note,
                "Closest NCERT chapter: %s (Class %s)" % (
                    ctx.get("chapter", "?"), ctx.get("grade", "?")),
                "Relevant formula(s): " + "; ".join(formulas),
                "Typical question types: " + ", ".join(ctx.get("question_types", [])[:3]),
            ]),
            "steps": [note, "Refer to NCERT chapter: %s." % ctx.get("chapter", "?")],
            "confidence": 0.55,
            "method": "ncert-retrieval",
            "chapter": ctx.get("chapter"),
            "grade": ctx.get("grade"),
            "relevant_formulas": formulas,
        }
    return {
        "answer": "Unable to solve",
        "solution": note + " Try rephrasing as a direct expression, equation, "
                           "derivative, integral, or limit.",
        "steps": [note],
        "confidence": 0.15,
        "method": "none",
    }


# ---------------------------------------------------------------------------
# Small deterministic word-problem helpers (common class 9-12 phrasings)
# ---------------------------------------------------------------------------
def _try_word_helpers(question: str):
    q = question.lower()

    # Factorial:  "7!", "7 factorial", "factorial of 7"
    m = (re.search(r"\b(\d+)\s*!", q)
         or re.search(r"\b(\d+)\s+factorial\b", q)
         or re.search(r"\bfactorial\s+(?:of\s+)?(\d+)\b", q))
    if m:
        n = int(m.group(1))
        if 0 <= n <= 1000:
            val = math.factorial(n)
            return _result(val, [
                "n! = 1 x 2 x 3 x ... x n.",
                "%d! = %d." % (n, val),
            ], 0.97, "permutations-combinations", question)

    # Circle: area / circumference from radius (exact pi form + decimal in steps)
    m = re.search(r"\b(area|circumference|perimeter)\b.*?\bcircle\b.*?"
                  r"\bradius\b\D*(\d+(?:\.\d+)?)", q)
    if not m:
        m = re.search(r"\bcircle\b.*?\bradius\b\D*(\d+(?:\.\d+)?).*?"
                      r"\b(area|circumference|perimeter)\b", q)
        if m:
            r_txt, kind = m.group(1), m.group(2)
        else:
            r_txt = kind = None
    else:
        kind, r_txt = m.group(1), m.group(2)
    if r_txt:
        r = float(r_txt)
        if kind == "area":
            exact = sp.Rational(str(r))**2 * pi
            return _result(_fmt(exact), [
                "Area of a circle = pi r^2.",
                "= pi x %g^2 = %s = approximately %s." % (r, _fmt(exact), round(float(exact.evalf()), 6)),
            ], 0.96, "circle-mensuration", question)
        else:
            exact = 2 * pi * sp.Rational(str(r))
            return _result(_fmt(exact), [
                "Circumference of a circle = 2 pi r.",
                "= 2 x pi x %g = %s = approximately %s." % (r, _fmt(exact), round(float(exact.evalf()), 6)),
            ], 0.96, "circle-mensuration", question)

    # Square / rectangle area
    m = re.search(r"\barea\b.*?\bsquare\b.*?\bside\b\D*(\d+(?:\.\d+)?)", q)
    if m:
        s = float(m.group(1)); a = s * s
        a = int(a) if abs(a - round(a)) < 1e-9 else round(a, 6)
        return _result(a, ["Area of a square = side^2.", "= %g^2 = %s." % (s, a)],
                       0.96, "mensuration", question)
    m = re.search(r"\barea\b.*?\brectangle\b\D*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)", q)
    if m:
        l, w = float(m.group(1)), float(m.group(2)); a = l * w
        a = int(a) if abs(a - round(a)) < 1e-9 else round(a, 6)
        return _result(a, ["Area of a rectangle = length x breadth.",
                           "= %g x %g = %s." % (l, w, a)], 0.96, "mensuration", question)

    # HCF / GCD
    m = re.search(r"\b(hcf|gcd|greatest common (?:divisor|factor))\b[^0-9]*"
                  r"(\d+)\D+(\d+)(?:\D+(\d+))?", q)
    if m:
        nums = [int(g) for g in m.groups()[1:] if g]
        g = nums[0]
        for n in nums[1:]:
            g = math.gcd(g, n)
        return _result(g, [
            "Identify: HCF (greatest common divisor) of %s." % ", ".join(map(str, nums)),
            "Use repeated gcd: %s." % " -> ".join(
                ["gcd(%d,%d)" % (nums[0], nums[1])] +
                ["= %d" % g for _ in [0]]),
            "HCF = %d." % g,
        ], 0.95, "number-theory", question)

    # LCM
    m = re.search(r"\b(lcm|least common multiple)\b[^0-9]*(\d+)\D+(\d+)(?:\D+(\d+))?", q)
    if m:
        nums = [int(g) for g in m.groups()[1:] if g]
        l = nums[0]
        for n in nums[1:]:
            l = l * n // math.gcd(l, n)
        return _result(l, [
            "Identify: LCM of %s." % ", ".join(map(str, nums)),
            "Use LCM(a,b) = a*b / HCF(a,b), extended pairwise.",
            "LCM = %d." % l,
        ], 0.95, "number-theory", question)

    # Sum of first n natural numbers
    m = re.search(r"sum of (?:the )?first\s+(\d+)\s+(?:natural\s+)?(?:positive\s+)?"
                  r"(?:integers?|numbers?)", q)
    if m:
        n = int(m.group(1))
        s = n * (n + 1) // 2
        return _result(s, [
            "Sum of first n natural numbers = n(n+1)/2.",
            "= %d(%d+1)/2 = %d." % (n, n, s),
        ], 0.97, "arithmetic-progression", question)

    # nCr  ("C(5,2)", "5C2", "5 choose 2", "ways to choose 2 from 5")
    m = (re.search(r"\bc\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)", q)
         or re.search(r"\b(\d+)\s*c\s*(\d+)\b", q)
         or re.search(r"\b(\d+)\s+choose\s+(\d+)\b", q))
    if not m:
        mm = re.search(r"(?:combination|choose|select|ways).*?(\d+).*?(\d+)", q)
        if mm and any(w in q for w in ("combination", "choose", "select", "ways")):
            m = mm
    if m and any(w in q for w in ("c(", "choose", "combination", "select", "ways")) \
            or (m and re.search(r"\b\d+\s*c\s*\d+\b", q)):
        n, r = int(m.group(1)), int(m.group(2))
        if r > n:
            n, r = r, n
        if 0 <= r <= n:
            val = math.comb(n, r)
            return _result(val, [
                "nCr = n! / (r!(n-r)!).",
                "C(%d,%d) = %d." % (n, r, val),
            ], 0.96, "permutations-combinations", question)

    # nPr  ("P(5,2)", "5P2", "permutations of 2 from 5", "arrange")
    m = (re.search(r"\bp\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)", q)
         or re.search(r"\b(\d+)\s*p\s*(\d+)\b", q))
    if not m:
        mm = re.search(r"(?:permutation|arrange).*?(\d+).*?(\d+)", q)
        if mm and any(w in q for w in ("permutation", "arrange")):
            m = mm
    if m and any(w in q for w in ("p(", "permutation", "arrange")) \
            or (m and re.search(r"\b\d+\s*p\s*\d+\b", q)):
        n, r = int(m.group(1)), int(m.group(2))
        if r > n:
            n, r = r, n
        if 0 <= r <= n:
            val = math.perm(n, r)
            return _result(val, [
                "nPr = n! / (n-r)!.",
                "P(%d,%d) = %d." % (n, r, val),
            ], 0.96, "permutations-combinations", question)

    # Mean / average / median / mode of an explicit list
    m = re.search(r"\b(mean|average|median|mode)\b.*?([\-\d.,\s]+)$", q)
    if m:
        kind = m.group(1)
        raw = re.findall(r"-?\d+(?:\.\d+)?", m.group(2))
        vals = [float(x) for x in raw]
        if len(vals) >= 2:
            if kind in ("mean", "average"):
                mv = sum(vals) / len(vals)
                ans = int(mv) if abs(mv - round(mv)) < 1e-9 else round(mv, 6)
                return _result(ans, [
                    "Mean = (sum of values) / (number of values).",
                    "= %s / %d = %s." % (sum(vals), len(vals), ans),
                ], 0.96, "statistics", question)
            if kind == "median":
                sv = sorted(vals)
                n = len(sv)
                med = sv[n // 2] if n % 2 else (sv[n // 2 - 1] + sv[n // 2]) / 2
                ans = int(med) if abs(med - round(med)) < 1e-9 else round(med, 6)
                return _result(ans, [
                    "Median = middle value of the ordered data.",
                    "Ordered: %s -> median = %s." % (sv, ans),
                ], 0.96, "statistics", question)
            if kind == "mode":
                from collections import Counter
                c = Counter(vals)
                top = max(c.values())
                modes = [k for k, v in c.items() if v == top]
                ans = (int(modes[0]) if len(modes) == 1 and abs(modes[0] - round(modes[0])) < 1e-9
                       else (modes[0] if len(modes) == 1 else modes))
                return _result(ans, [
                    "Mode = most frequently occurring value.",
                    "Frequencies: %s -> mode = %s." % (dict(c), ans),
                ], 0.93, "statistics", question)

    # Heron's formula: area of triangle with sides a, b, c
    m = re.search(r"area of (?:a )?triangle.*?sides?\s*[:=]?\s*"
                  r"(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)", q)
    if m:
        a, b, c = (float(m.group(1)), float(m.group(2)), float(m.group(3)))
        if a + b > c and a + c > b and b + c > a:
            s = (a + b + c) / 2
            area = math.sqrt(s * (s - a) * (s - b) * (s - c))
            ans = int(area) if abs(area - round(area)) < 1e-9 else round(area, 6)
            return _result(ans, [
                "Heron's formula: s = (a+b+c)/2, Area = sqrt(s(s-a)(s-b)(s-c)).",
                "s = (%g+%g+%g)/2 = %g." % (a, b, c, s),
                "Area = sqrt(%g*%g*%g*%g) = %s." % (s, s - a, s - b, s - c, ans),
            ], 0.96, "herons-formula", question)

    return None


# ---------------------------------------------------------------------------
# Core CAS routing
# ---------------------------------------------------------------------------
def _split_equation(text: str):
    """Return (lhs, rhs) strings if `text` is a single equation, else None."""
    # Avoid relational operators that are not plain equality.
    if re.search(r"(<=|>=|==|!=|<|>)", text):
        return None
    if text.count("=") != 1:
        return None
    lhs, rhs = text.split("=", 1)
    return lhs.strip(), rhs.strip()


def _solve_system(question: str):
    body = _strip_lead(question)
    # Pull out comma / semicolon / "and" separated equations.
    parts = re.split(r"\s*(?:,|;|\band\b)\s*", body, flags=re.I)
    eqs = []
    for p in parts:
        sp_eq = _split_equation(p)
        if not sp_eq:
            return None
        lhs, rhs = sp_eq
        if _looks_like_prose(lhs) or _looks_like_prose(rhs):
            return None
        eqs.append(Eq(_parse(lhs), _parse(rhs)))
    if len(eqs) < 2:
        return None
    syms = sorted(set().union(*[e.free_symbols for e in eqs]), key=lambda x: x.name)
    if not syms:
        return None
    sol = sp_solve(eqs, list(syms), dict=True)
    if not sol:
        return _result("No solution", [
            "Set up the system: " + "; ".join(_fmt(e) for e in eqs),
            "The system is inconsistent (no common solution).",
        ], 0.9, "linear-system", question)
    s0 = sol[0]
    pretty = ", ".join("%s = %s" % (k, _fmt(v)) for k, v in s0.items())
    return _result(pretty, [
        "Set up the system: " + "; ".join(_fmt(e) for e in eqs),
        "Solve simultaneously (elimination / substitution).",
        "Solution: " + pretty,
    ], 0.96, "linear-system", question)


def _solve_equation(question: str):
    body = _strip_lead(question)
    eq = _split_equation(body)
    if not eq:
        return None
    lhs, rhs = eq
    if _looks_like_prose(lhs) or _looks_like_prose(rhs):
        return None
    L, R = _parse(lhs), _parse(rhs)
    expr = sp.expand(L - R)
    var = _free_symbol(expr) if expr.free_symbols else _free_symbol(L + R)
    roots = sp_solve(Eq(L, R), var, dict=False)
    steps = ["Equation: %s = %s." % (_fmt(L), _fmt(R)),
             "Bring all terms to one side: %s = 0." % _fmt(expr)]
    method = "equation"
    degree = None
    try:
        if expr.free_symbols and var in expr.free_symbols:
            degree = sp.degree(expr, var)
    except Exception:
        degree = None
    if degree == 2:
        method = "quadratic-equation"
        try:
            poly = sp.Poly(expr, var)
            a, b, c = (poly.nth(2), poly.nth(1), poly.nth(0))
            D = sp.simplify(b**2 - 4*a*c)
            steps.append("Quadratic in %s: a=%s, b=%s, c=%s; discriminant D = b^2-4ac = %s."
                         % (var, _fmt(a), _fmt(b), _fmt(c), _fmt(D)))
            steps.append("Apply %s = (-b +/- sqrt(D)) / (2a)." % var)
        except Exception:
            pass
    elif degree == 1:
        steps.append("Linear in %s: isolate %s." % (var, var))
    if not roots:
        return _result("No real solution", steps + ["No solution exists."],
                       0.9, method, question)
    root_strs = [_fmt(r) for r in roots]
    answer = root_strs[0] if len(root_strs) == 1 else "{ " + ", ".join(root_strs) + " }"
    steps.append("Solution: %s = %s." % (var, ", ".join(root_strs)))
    return _result(answer, steps, 0.97, method, question)


def _calculus(question: str):
    body = _strip_lead(question)
    q = question.lower()

    # ----- limit -----
    if re.search(r"\blim(it)?\b", q) or "\\lim" in question:
        # point: "as x approaches/tends to A" or "x -> A"
        m = re.search(r"\bas\s+(\w+)\s*(?:->|→|approaches|tends to)\s*"
                      r"([^\s,;]+)", q)
        m2 = re.search(r"(\w+)\s*(?:->|→)\s*([^\s,;]+)", q)
        var_name, pt_text = None, None
        if m:
            var_name, pt_text = m.group(1), m.group(2)
        elif m2:
            var_name, pt_text = m2.group(1), m2.group(2)
        # Strip the "as x -> A" clause and the word "limit" from the expression.
        body2 = re.sub(r"\bas\s+\w+\s*(?:->|→|approaches|tends to)\s*\S+",
                       " ", body, flags=re.I)
        body2 = re.sub(r"\w+\s*(?:->|→)\s*\S+", " ", body2)
        body2 = re.sub(r"\blim(it)?s?\b", " ", body2, flags=re.I)
        body2 = _strip_filler(body2)
        expr = _parse(body2)
        var = Symbol(var_name) if var_name else _free_symbol(expr)
        point = oo
        if pt_text:
            pl = pt_text.lower()
            if pl in ("infinity", "inf", "oo", "+infinity", "+inf"):
                point = oo
            elif pl in ("-infinity", "-inf", "-oo"):
                point = -oo
            else:
                try:
                    point = _parse(pt_text)
                except Exception:
                    point = sympify(0)
        val = limit(expr, var, point)
        return _result(_answer_value(val), [
            "Evaluate limit of %s as %s -> %s." % (_fmt(expr), var, _fmt(point)),
            "Apply standard limit rules / known limits (e.g. sin(x)/x -> 1).",
            "Limit = %s." % _fmt(val),
        ], 0.95, "limit", question)

    # ----- derivative -----
    if re.search(r"\b(differentiate|derivative|d\s*/\s*d\s*[a-z])\b", q):
        mvar = re.search(r"with respect to\s+([a-z])\b", q)
        body2 = re.sub(r"\bd\s*/\s*d\s*[a-z]\b", " ", body, flags=re.I)
        body2 = re.sub(r"\b(differentiate|derivatives?)\b", " ", body2, flags=re.I)
        body2 = re.sub(r"\bwith respect to\s+\w+", " ", body2, flags=re.I)
        body2 = _strip_filler(body2)
        expr = _parse(body2)
        var = Symbol(mvar.group(1)) if mvar else _free_symbol(expr)
        d = sp.simplify(diff(expr, var))
        return _result(_answer_value(d), [
            "Differentiate %s with respect to %s." % (_fmt(expr), var),
            "Apply power / product / quotient / chain rules term by term.",
            "d/d%s = %s." % (var, _fmt(d)),
        ], 0.97, "derivative", question)

    # ----- integral -----
    if re.search(r"\b(integrate|integral|antiderivative)\b", q) or "∫" in question:
        # definite bounds: "from a to b" or "between a and b"
        mb = (re.search(r"from\s+(\S+)\s+to\s+(\S+)", q)
              or re.search(r"between\s+(\S+)\s+and\s+(\S+)", q))
        body2 = re.sub(r"from\s+\S+\s+to\s+\S+", " ", body, flags=re.I)
        body2 = re.sub(r"between\s+\S+\s+and\s+\S+", " ", body2, flags=re.I)
        body2 = re.sub(r"\b(integrate|integrals?|antiderivatives?)\b", " ", body2, flags=re.I)
        body2 = re.sub(r"\bd\s*[a-z]\b", " ", body2, flags=re.I)
        body2 = re.sub(r"with respect to\s+\w+", " ", body2, flags=re.I)
        body2 = re.sub(r"∫", " ", body2)
        body2 = _strip_filler(body2)
        expr = _parse(body2)
        var = _free_symbol(expr)
        if mb:
            a, b = _parse(mb.group(1)), _parse(mb.group(2))
            val = integrate(expr, (var, a, b))
            return _result(_answer_value(val), [
                "Definite integral of %s from %s to %s." % (_fmt(expr), _fmt(a), _fmt(b)),
                "Find an antiderivative F(%s), then compute F(%s) - F(%s)." % (var, _fmt(b), _fmt(a)),
                "Value = %s." % _fmt(val),
            ], 0.96, "definite-integral", question)
        val = integrate(expr, var)
        return _result(_fmt(val) + " + C", [
            "Integrate %s with respect to %s." % (_fmt(expr), var),
            "Apply the reverse power rule / standard integrals.",
            "Result = %s + C." % _fmt(val),
        ], 0.96, "indefinite-integral", question)

    return None


def _matrix(question: str):
    q = question.lower()
    if "[[" not in question and "matrix" not in q and "determinant" not in q:
        return None
    # Extract bracketed row lists like [[1,2],[3,4]]
    m = re.findall(r"\[\s*(\[[^\]]*\](?:\s*,\s*\[[^\]]*\])*)\s*\]", question)
    if not m:
        # try "determinant of [1 2; 3 4]" style
        m2 = re.search(r"\[([^\]]+)\]", question)
        if not m2:
            return None
        rows = [list(map(lambda x: _parse(x), re.split(r"[,\s]+", r.strip())))
                for r in m2.group(1).split(";") if r.strip()]
        M = Matrix(rows)
    else:
        rows_text = "[" + m[0] + "]"
        data = json.loads(rows_text.replace(" ", ""))
        M = Matrix(data)
    if "determinant" in q or "det" in q:
        d = M.det()
        return _result(_answer_value(d), [
            "Matrix M = %s." % _fmt(M),
            "Compute det(M) by cofactor expansion.",
            "det(M) = %s." % _fmt(d),
        ], 0.97, "determinant", question)
    if "inverse" in q:
        if M.det() == 0:
            return _result("Not invertible (det = 0)", [
                "Matrix M = %s." % _fmt(M),
                "det(M) = 0, so the inverse does not exist.",
            ], 0.95, "matrix-inverse", question)
        inv = M.inv()
        return _result(_fmt(inv), [
            "Matrix M = %s." % _fmt(M),
            "M^{-1} = (1/det(M)) * adj(M).",
            "M^{-1} = %s." % _fmt(inv),
        ], 0.96, "matrix-inverse", question)
    if "transpose" in q:
        return _result(_fmt(M.T), [
            "Matrix M = %s." % _fmt(M), "Transpose swaps rows and columns.",
            "M^T = %s." % _fmt(M.T),
        ], 0.97, "matrix", question)
    # default: just echo / rank
    return _result(_fmt(M), [
        "Matrix M = %s." % _fmt(M), "rank(M) = %s." % M.rank(),
    ], 0.8, "matrix", question)


def _algebra_or_value(question: str):
    body = _strip_lead(question)
    if _looks_like_prose(body):
        return None  # not a math expression -> let the dispatcher fall to _fail
    q = question.lower()
    expr = _parse(body)
    # If parsing prose slipped through, the result is a soup of single letters.
    if len(getattr(expr, "free_symbols", set())) >= 4 and not re.search(r"[\^*/()]|\bsqrt\b", body):
        return None

    if re.search(r"\bfactor", q):
        f = factor(expr)
        return _result(_fmt(f), [
            "Factorize %s." % _fmt(expr),
            "Use algebraic identities / common-factor / splitting the middle term.",
            "Factored form: %s." % _fmt(f),
        ], 0.97, "factor", question)

    if re.search(r"\bexpand", q):
        ex = expand(expr)
        return _result(_fmt(ex), [
            "Expand %s." % _fmt(expr),
            "Apply distributive law / binomial identities.",
            "Expanded form: %s." % _fmt(ex),
        ], 0.97, "expand", question)

    if re.search(r"\b(zeroes?|zeros|roots)\b", q) and expr.free_symbols:
        var = _free_symbol(expr)
        roots = sp_solve(Eq(expr, 0), var)
        rs = [_fmt(r) for r in roots]
        return _result("{ " + ", ".join(rs) + " }" if len(rs) != 1 else rs[0], [
            "Find the zeroes of %s." % _fmt(expr),
            "Solve %s = 0 for %s." % (_fmt(expr), var),
            "Zeroes: %s." % ", ".join(rs),
        ], 0.97, "polynomial-roots", question)

    # No variables -> pure numeric evaluation (keep exact fractions / surds).
    if not expr.free_symbols:
        exact = sp.simplify(expr)
        answer = _answer_value(exact)
        steps = ["Evaluate %s." % _fmt(expr)]
        dec = _decimal_of(exact)
        if not getattr(exact, "is_Integer", False) and dec is not None and str(dec) != str(answer):
            steps.append("Exact value = %s." % _fmt(exact))
            steps.append("Decimal approximation = %s." % dec)
        else:
            steps.append("= %s." % answer)
        return _result(answer, steps, 0.98, "evaluate", question)

    # Has variables -> simplify.
    simp = simplify(expr)
    return _result(_fmt(simp), [
        "Simplify %s." % _fmt(expr),
        "Combine like terms and reduce.",
        "Simplified form: %s." % _fmt(simp),
    ], 0.9 if simp != expr else 0.8, "simplify", question)


# ---------------------------------------------------------------------------
# Top-level dispatcher
# ---------------------------------------------------------------------------
def solve_problem(question: str) -> dict:
    question = (question or "").strip()
    if not question:
        return {"answer": "Empty input", "solution": "No question provided.",
                "steps": [], "confidence": 0.0, "method": "none"}

    if not _SYMPY_OK:
        try:
            val = eval(_clean_math(question).replace("^", "**"),  # noqa: S307
                       {"__builtins__": {}}, {"sqrt": math.sqrt, "pi": math.pi})
            return {"answer": val, "solution": "Direct evaluation.", "steps": [],
                    "confidence": 0.7, "method": "arith-fallback"}
        except Exception:
            return _fail(question, "SymPy is not installed; only arithmetic is available.")

    # Ordered routing: most specific first.
    routers = (
        _try_word_helpers,
        _solve_system,
        _solve_equation,
        _calculus,
        _matrix,
        _algebra_or_value,
    )
    for fn in routers:
        try:
            res = fn(question)
            if res is not None:
                return res
        except Exception:
            continue

    return _fail(question)


def main():
    parser = argparse.ArgumentParser(description="NEXUS deterministic CAS solver")
    parser.add_argument("--problem", type=str, required=True)
    parser.add_argument("--num_samples", type=int, default=4)   # accepted, unused
    parser.add_argument("--time_budget", type=int, default=120)  # accepted, unused
    parser.add_argument("--model", type=str, default="simple")   # accepted, unused
    args = parser.parse_args()

    try:
        result = solve_problem(args.problem)
    except Exception as e:  # absolute last resort - never break the JSON contract
        result = {"answer": "Solver error", "solution": "Internal error: %s" % e,
                  "steps": [], "confidence": 0.0, "method": "error"}
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
