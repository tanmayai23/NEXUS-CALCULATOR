"""Build Class 9 NCERT chapter-wise SFT training data."""

import json
from pathlib import Path
from typing import Dict, List


ROOT = Path(__file__).resolve().parent
CURRICULUM_PATH = ROOT / "class9_curriculum.json"
OUTPUT_PATH = ROOT / "class9_training_data.json"


def _chapter_formula_prompt(chapter: Dict) -> Dict:
    formulas = chapter.get("formulas", [])
    bullet_formulas = "\n".join([f"- {f}" for f in formulas])

    return {
        "problem": f"What are the formulas of Chapter {chapter['id']} ({chapter['name']}) in Class 9 NCERT?",
        "solution": (
            f"Chapter {chapter['id']} ({chapter['name']}) key formulas are:\n"
            f"{bullet_formulas}\n"
            "Use these formulas only when the domain conditions are satisfied."
        ),
        "answer": "; ".join(formulas),
        "subject": chapter["name"],
        "level": 1,
        "source": "class9-ncert"
    }


def _chapter_question_type_prompt(chapter: Dict) -> Dict:
    q_types = chapter.get("question_types", [])
    bullet_q = "\n".join([f"- {q}" for q in q_types])

    return {
        "problem": (
            f"What type of questions are commonly asked from Chapter {chapter['id']} "
            f"({chapter['name']}) in Class 9 NCERT?"
        ),
        "solution": (
            f"Common question patterns from Chapter {chapter['id']} ({chapter['name']}) are:\n"
            f"{bullet_q}\n"
            "Focus on concept explanation, direct application, and proof-based variations."
        ),
        "answer": "; ".join(q_types),
        "subject": chapter["name"],
        "level": 1,
        "source": "class9-ncert"
    }


def _formula_to_drill_prompt(chapter: Dict, formula: str) -> Dict:
    return {
        "problem": (
            f"In Chapter {chapter['id']} ({chapter['name']}), explain the formula '{formula}' "
            "and mention one question style where it is used."
        ),
        "solution": (
            f"Formula: {formula}.\n"
            f"This belongs to Chapter {chapter['id']} ({chapter['name']}).\n"
            "Typical use: direct substitution problem, simplification, or proof step depending on context."
        ),
        "answer": formula,
        "subject": chapter["name"],
        "level": 2,
        "source": "class9-ncert"
    }


def build_class9_training_data(
    curriculum_path: Path = CURRICULUM_PATH,
    output_path: Path = OUTPUT_PATH,
) -> List[Dict]:
    with open(curriculum_path, "r", encoding="utf-8") as f:
        curriculum = json.load(f)

    chapters = curriculum.get("chapters", [])
    training_data: List[Dict] = []

    for chapter in chapters:
        training_data.append(_chapter_formula_prompt(chapter))
        training_data.append(_chapter_question_type_prompt(chapter))

        for formula in chapter.get("formulas", []):
            training_data.append(_formula_to_drill_prompt(chapter, formula))

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(training_data, f, indent=2, ensure_ascii=True)

    return training_data


if __name__ == "__main__":
    data = build_class9_training_data()
    print(f"Built {len(data)} Class 9 training examples at {OUTPUT_PATH}")
