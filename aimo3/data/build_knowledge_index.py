#!/usr/bin/env python
"""
Build the NCERT knowledge index used by the solver's retrieval layer.

Output: aimo3/data/ncert_knowledge_index.json
  A list of chunks, one per (grade, chapter):
    {
      "grade": 9,
      "chapter_id": 2,
      "chapter": "Polynomials",
      "part": 1,
      "formulas": [...],
      "question_types": [...],
      "source_pdf": "class 9/iemh102.pdf",
      "text_excerpt": "...first few KB of useful chapter text..."
    }

Primary source is aimo3/data/ncert_curriculum_9_12.json (always present,
well-structured). PDF text excerpts are best-effort (PyPDF2) and the index is
fully usable even if every PDF extraction fails.

Run:  python build_knowledge_index.py
"""

import os
import re
import json
import glob

_HERE = os.path.dirname(os.path.abspath(__file__))
_AIMO3 = os.path.dirname(_HERE)
_ROOT = os.path.dirname(_AIMO3)

CURRICULUM_PATH = os.path.join(_HERE, "ncert_curriculum_9_12.json")
OUT_PATH = os.path.join(_HERE, "ncert_knowledge_index.json")

# grade -> (folder name, filename prefix letter)
GRADE_FOLDERS = {
    9: [("class 9", "iemh1")],
    10: [("class 10", "jemh1")],
    11: [("class 11", "kemh1")],
    12: [("class 12 part 1", "lemh1"), ("class 12 part 2", "lemh2")],
}

EXCERPT_CHARS = 2500


def _find_pdf(grade: int, chapter_id: int, part: int):
    """Locate the NCERT PDF for a given grade/chapter, return (relpath, abspath)."""
    for folder, prefix in GRADE_FOLDERS.get(grade, []):
        # Class 12 splits chapters across two parts; honour the curriculum's part.
        if grade == 12:
            want_prefix = "lemh%d" % part
            if prefix != want_prefix:
                continue
        base = os.path.join(_ROOT, folder)
        if not os.path.isdir(base):
            continue
        for cand in ("%s%02d.pdf" % (prefix, chapter_id),
                     "%s%d.pdf" % (prefix, chapter_id)):
            p = os.path.join(base, cand)
            if os.path.isfile(p):
                return os.path.join(folder, cand), p
    return None, None


def _extract_excerpt(pdf_path: str) -> str:
    try:
        import PyPDF2  # type: ignore
    except Exception:
        return ""
    try:
        text_parts = []
        with open(pdf_path, "rb") as fh:
            reader = PyPDF2.PdfReader(fh)
            for page in reader.pages[:6]:  # first few pages carry the core content
                try:
                    text_parts.append(page.extract_text() or "")
                except Exception:
                    continue
                if sum(len(t) for t in text_parts) > EXCERPT_CHARS * 3:
                    break
        raw = "\n".join(text_parts)
    except Exception:
        return ""
    # Tidy whitespace; keep it compact.
    raw = re.sub(r"[ \t]+", " ", raw)
    raw = re.sub(r"\n{2,}", "\n", raw).strip()
    return raw[:EXCERPT_CHARS]


def build() -> list:
    with open(CURRICULUM_PATH, "r", encoding="utf-8") as fh:
        curriculum = json.load(fh)

    chunks = []
    pdf_hits = 0
    for cls in curriculum.get("classes", []):
        grade = cls.get("grade")
        for ch in cls.get("chapters", []):
            cid = ch.get("id")
            part = ch.get("part", 1)
            relpath, abspath = _find_pdf(grade, cid, part)
            excerpt = _extract_excerpt(abspath) if abspath else ""
            if excerpt:
                pdf_hits += 1
            chunks.append({
                "grade": grade,
                "chapter_id": cid,
                "chapter": ch.get("name"),
                "part": part,
                "formulas": ch.get("formulas", []),
                "question_types": ch.get("question_types", []),
                "source_pdf": relpath,
                "text_excerpt": excerpt,
            })
    print("Indexed %d chapters (%d with PDF text)." % (len(chunks), pdf_hits))
    return chunks


def main():
    chunks = build()
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump({"chunks": chunks}, fh, ensure_ascii=False, indent=1)
    print("Wrote %s" % OUT_PATH)


if __name__ == "__main__":
    main()
