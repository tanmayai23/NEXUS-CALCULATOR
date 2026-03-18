"""Build NCERT Class 9-12 chapter-wise SFT datasets."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional


ROOT = Path(__file__).resolve().parent
CURRICULUM_PATH = ROOT / "ncert_curriculum_9_12.json"


def _chapter_title(chapter: Dict) -> str:
    part = chapter.get("part")
    if part is None:
        return chapter["name"]
    return f"{chapter['name']} (Part {part})"


def _formula_prompt(grade: int, chapter: Dict) -> Dict:
    formulas = chapter.get("formulas", [])
    return {
        "problem": f"List all formulas from Class {grade} Chapter {chapter['id']}: {_chapter_title(chapter)}.",
        "solution": "\n".join([f"- {formula}" for formula in formulas]),
        "answer": "; ".join(formulas),
        "subject": f"Class {grade} - {_chapter_title(chapter)}",
        "level": 1,
        "source": "ncert-9-12"
    }


def _question_type_prompt(grade: int, chapter: Dict) -> Dict:
    q_types = chapter.get("question_types", [])
    return {
        "problem": (
            f"What question types are commonly asked from Class {grade} Chapter {chapter['id']}: "
            f"{_chapter_title(chapter)}?"
        ),
        "solution": "\n".join([f"- {q_type}" for q_type in q_types]),
        "answer": "; ".join(q_types),
        "subject": f"Class {grade} - {_chapter_title(chapter)}",
        "level": 1,
        "source": "ncert-9-12"
    }


def _formula_drill_prompt(grade: int, chapter: Dict, formula: str) -> Dict:
    return {
        "problem": (
            f"Explain this formula from Class {grade} Chapter {chapter['id']} ({_chapter_title(chapter)}): "
            f"{formula}. Also mention a typical question style where it is used."
        ),
        "solution": (
            f"Formula: {formula}\n"
            "Use this in direct application, derivation/proof steps, and mixed conceptual numericals where applicable."
        ),
        "answer": formula,
        "subject": f"Class {grade} - {_chapter_title(chapter)}",
        "level": 2,
        "source": "ncert-9-12"
    }


def _chapter_summary_prompt(grade: int, chapter: Dict) -> Dict:
    formulas = chapter.get("formulas", [])
    q_types = chapter.get("question_types", [])
    return {
        "problem": (
            f"Give a complete chapter revision for Class {grade} Chapter {chapter['id']} "
            f"({_chapter_title(chapter)}): include key formulas and expected question patterns."
        ),
        "solution": (
            "Key formulas:\n"
            + "\n".join([f"- {formula}" for formula in formulas])
            + "\nExpected question patterns:\n"
            + "\n".join([f"- {q_type}" for q_type in q_types])
        ),
        "answer": f"Formulas: {'; '.join(formulas)} | Question types: {'; '.join(q_types)}",
        "subject": f"Class {grade} - {_chapter_title(chapter)}",
        "level": 2,
        "source": "ncert-9-12"
    }


def load_curriculum(path: Path = CURRICULUM_PATH) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_training_data_for_grade(grade: int, output_path: Optional[Path] = None) -> List[Dict]:
    curriculum = load_curriculum()

    classes = curriculum.get("classes", [])
    selected = [item for item in classes if item.get("grade") == grade]
    if not selected:
        raise ValueError(f"Grade {grade} not found in curriculum")

    chapters = selected[0].get("chapters", [])
    training_data: List[Dict] = []

    for chapter in chapters:
        training_data.append(_formula_prompt(grade, chapter))
        training_data.append(_question_type_prompt(grade, chapter))
        training_data.append(_chapter_summary_prompt(grade, chapter))

        for formula in chapter.get("formulas", []):
            training_data.append(_formula_drill_prompt(grade, chapter, formula))

    if output_path is not None:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(training_data, f, indent=2, ensure_ascii=True)

    return training_data


def build_training_data_all_grades(output_dir: Optional[Path] = None) -> Dict[int, List[Dict]]:
    output_dir = output_dir or ROOT
    result: Dict[int, List[Dict]] = {}

    for grade in [9, 10, 11, 12]:
        output_path = output_dir / f"class{grade}_training_data.json"
        result[grade] = build_training_data_for_grade(grade=grade, output_path=output_path)

    return result


def build_training_todo(output_path: Optional[Path] = None) -> str:
    curriculum = load_curriculum()
    lines: List[str] = ["# NCERT Class 9-12 Training TODO", "", "## Chapter Coverage Checklist"]

    for cls in curriculum.get("classes", []):
        grade = cls.get("grade")
        lines.append("")
        lines.append(f"### Class {grade}")
        for chapter in cls.get("chapters", []):
            chapter_name = _chapter_title(chapter)
            lines.append(f"- [ ] Chapter {chapter['id']}: {chapter_name}")
            lines.append("- [ ] Verify all formulas with notation and constraints")
            lines.append("- [ ] Verify all expected question types")
            lines.append("- [ ] Add solved examples: easy, medium, hard")
            lines.append("- [ ] Add exercise question variants")
            lines.append("- [ ] Evaluate formula recall and chapter QA")

    text = "\n".join(lines) + "\n"
    if output_path is not None:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)

    return text


if __name__ == "__main__":
    all_data = build_training_data_all_grades()
    todo_path = ROOT / "ncert_9_12_training_todo.md"
    build_training_todo(todo_path)

    for grade, data in all_data.items():
        print(f"Class {grade}: built {len(data)} examples")
    print(f"TODO written to {todo_path}")
