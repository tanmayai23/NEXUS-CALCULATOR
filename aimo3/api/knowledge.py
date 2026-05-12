#!/usr/bin/env python
"""
Lightweight NCERT knowledge retrieval (no embeddings model required).

Loads aimo3/data/ncert_knowledge_index.json (built by
aimo3/data/build_knowledge_index.py) and answers `retrieve(question)` with the
most relevant chapter, its formulas, and a few question-specific formula picks
using a small TF-IDF scorer over the curriculum text + PDF excerpts.

If the index file is missing, `retrieve` returns {} so callers degrade cleanly.
"""

import os
import re
import json
import math
from functools import lru_cache

_HERE = os.path.dirname(os.path.abspath(__file__))
_AIMO3 = os.path.dirname(_HERE)
INDEX_PATH = os.path.join(_AIMO3, "data", "ncert_knowledge_index.json")

_STOPWORDS = {
    "the", "a", "an", "of", "to", "in", "is", "are", "for", "and", "or", "on",
    "with", "by", "as", "at", "be", "this", "that", "it", "from", "what", "which",
    "find", "calculate", "compute", "evaluate", "solve", "value", "values",
    "given", "if", "then", "where", "when", "show", "prove", "using", "use",
    "please", "can", "you", "me", "my", "we", "let", "its", "their", "between",
    "two", "three", "four", "number", "numbers",
}

# Query-side synonym expansion so different phrasings hit the same chapter terms.
_SYNONYMS = {
    "factorise": "factor", "factorize": "factor", "factorisation": "factor",
    "factorization": "factor",
    "zeroes": "roots", "zeros": "roots", "zero": "roots",
    "differentiate": "derivative", "differentiation": "derivative",
    "integration": "integral", "antiderivative": "integral",
    "hcf": "gcd", "lcm": "multiple",
    "simultaneous": "linear", "equations": "equation",
    "probability": "probability", "perpendicular": "perpendicular",
    "trig": "trigonometry", "trigonometric": "trigonometry",
    "ap": "progression", "gp": "progression",
    "mensuration": "volume", "cuboid": "volume", "cylinder": "volume",
    "cone": "volume", "sphere": "volume", "frustum": "volume",
    "elevation": "trigonometry", "depression": "trigonometry",
    "tangent": "circle", "chord": "circle",
    "matrix": "matrix", "matrices": "matrix", "determinant": "determinant",
    "vector": "vector", "vectors": "vector",
    "limit": "limit", "derivative": "derivative", "integral": "integral",
}


def _norm(tok: str) -> str:
    tok = _SYNONYMS.get(tok, tok)
    # Light plural/verb normalisation so "derivatives" == "derivative" etc.
    if len(tok) > 4 and tok.endswith("ies"):
        tok = tok[:-3] + "y"
    elif len(tok) > 4 and tok.endswith("es") and not tok.endswith("ses"):
        tok = tok[:-2]
    elif len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
        tok = tok[:-1]
    return _SYNONYMS.get(tok, tok)


def _tokens(text: str):
    text = (text or "").lower()
    raw = re.findall(r"[a-z][a-z0-9_]*", text)
    out = []
    for tok in raw:
        if len(tok) < 2 or tok in _STOPWORDS:
            continue
        out.append(_norm(tok))
    return out


@lru_cache(maxsize=1)
def _load():
    """Return (chunks, idf) or ([], {}) if the index is unavailable."""
    if not os.path.isfile(INDEX_PATH):
        return [], {}
    try:
        with open(INDEX_PATH, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return [], {}
    chunks = data.get("chunks", [])
    docs = []
    for ch in chunks:
        doc_text = " ".join([
            str(ch.get("chapter", "")),
            " ".join(ch.get("formulas", [])),
            " ".join(ch.get("question_types", [])),
            ch.get("text_excerpt", ""),
        ])
        ch["_tokens"] = _tokens(doc_text)
        ch["_tf"] = {}
        for t in ch["_tokens"]:
            ch["_tf"][t] = ch["_tf"].get(t, 0) + 1
        docs.append(ch["_tokens"])
    n = max(len(docs), 1)
    df = {}
    for toks in docs:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((n + 1) / (c + 0.5)) + 1.0 for t, c in df.items()}
    return chunks, idf


def _score_chunk(chunk, q_tokens, q_text_lower, idf):
    tf = chunk.get("_tf", {})
    length = max(len(chunk.get("_tokens", [])), 1)
    score = 0.0
    for t in q_tokens:
        if t in tf:
            score += (tf[t] / length) * idf.get(t, 1.0)
    # Strong bonus when the chapter name appears (mostly) verbatim.
    cname = str(chunk.get("chapter", "")).lower()
    if cname and cname in q_text_lower:
        score += 5.0
    else:
        cname_toks = set(_tokens(cname))
        if cname_toks and cname_toks.issubset(set(q_tokens)):
            score += 3.0
    return score


def _pick_formulas(chunk, q_tokens, limit=3):
    formulas = chunk.get("formulas", []) or []
    if not formulas:
        return []
    qset = set(q_tokens)
    scored = []
    for f in formulas:
        ftoks = set(_tokens(f))
        overlap = len(ftoks & qset)
        scored.append((overlap, f))
    scored.sort(key=lambda x: (-x[0], formulas.index(x[1])))
    chosen = [f for ov, f in scored if ov > 0][:limit]
    if not chosen:                       # nothing matched -> return the first few
        chosen = formulas[:limit]
    return chosen


def retrieve(question: str) -> dict:
    """Return {} or {grade, chapter, chapter_id, formulas, relevant_formulas,
    question_types, source_pdf, score} for the best-matching NCERT chapter."""
    chunks, idf = _load()
    if not chunks:
        return {}
    q_tokens = _tokens(question)
    if not q_tokens:
        return {}
    q_lower = (question or "").lower()
    best, best_score = None, 0.0
    for ch in chunks:
        s = _score_chunk(ch, q_tokens, q_lower, idf)
        if s > best_score:
            best, best_score = ch, s
    if best is None or best_score <= 0:
        return {}
    return {
        "grade": best.get("grade"),
        "chapter_id": best.get("chapter_id"),
        "chapter": best.get("chapter"),
        "formulas": best.get("formulas", []),
        "relevant_formulas": _pick_formulas(best, q_tokens),
        "question_types": best.get("question_types", []),
        "source_pdf": best.get("source_pdf"),
        "score": round(best_score, 4),
    }


_PUBLIC_KEYS = ("grade", "chapter_id", "chapter", "part",
                "formulas", "question_types", "source_pdf")


def lookup_chapter(grade=None, name=None) -> dict:
    """Return the index chunk for a given (grade, chapter name), or {}."""
    chunks, _ = _load()
    if not chunks:
        return {}
    name_l = (name or "").strip().lower()
    for ch in chunks:
        if grade is not None and ch.get("grade") != grade:
            continue
        if name_l and str(ch.get("chapter", "")).strip().lower() != name_l:
            continue
        return {k: ch[k] for k in _PUBLIC_KEYS if k in ch}
    # Fall back: ignore grade, match on name only.
    if name_l:
        for ch in chunks:
            if str(ch.get("chapter", "")).strip().lower() == name_l:
                return {k: ch[k] for k in _PUBLIC_KEYS if k in ch}
    return {}


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "factorize x^2 - 5x + 6"
    print(json.dumps(retrieve(q), indent=2, ensure_ascii=False))
