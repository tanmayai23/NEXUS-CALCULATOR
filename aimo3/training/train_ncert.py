"""Train NCERT chapter-wise models for Class 9-12."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

from data.ncert_training_builder import (
    build_training_data_all_grades,
    build_training_data_for_grade,
    build_training_todo,
)
from training.trainer import train_math_model


def _train_one_grade(grade: int, train_data: List[Dict], args: argparse.Namespace) -> str:
    output_dir = Path(args.output) / f"class{grade}_ncert"
    model_path = train_math_model(
        train_data=train_data,
        model_name=args.model,
        output_dir=str(output_dir),
        num_epochs=args.epochs,
        learning_rate=args.lr,
        max_seq_length=args.max_seq_length,
        max_steps=args.max_steps,
    )
    return model_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Train NCERT chapter-wise model(s)")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-Math-7B-Instruct")
    parser.add_argument("--output", type=str, default="./outputs/ncert_9_12")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=2048)
    parser.add_argument("--max_steps", type=int, default=-1)
    parser.add_argument("--grade", type=int, choices=[9, 10, 11, 12], help="Train one class only")
    parser.add_argument("--all_grades", action="store_true", help="Train all classes 9 to 12")
    parser.add_argument("--build_only", action="store_true", help="Only build datasets and TODO")

    args = parser.parse_args()

    data_dir = Path(__file__).resolve().parents[1] / "data"
    todo_path = data_dir / "ncert_9_12_training_todo.md"
    build_training_todo(todo_path)
    print(f"Wrote chapter-wise TODO: {todo_path}")

    if args.grade:
        dataset_path = data_dir / f"class{args.grade}_training_data.json"
        train_data = build_training_data_for_grade(args.grade, output_path=dataset_path)
        print(f"Built Class {args.grade} dataset with {len(train_data)} examples: {dataset_path}")

        if args.build_only:
            return

        model_path = _train_one_grade(args.grade, train_data, args)
        print(f"Class {args.grade} model saved at: {model_path}")
        return

    datasets = build_training_data_all_grades(output_dir=data_dir)
    for grade, train_data in datasets.items():
        print(f"Built Class {grade} dataset with {len(train_data)} examples")

    if args.build_only:
        return

    if not args.all_grades:
        raise ValueError("Use --grade <9|10|11|12> or --all_grades for training")

    for grade in [9, 10, 11, 12]:
        model_path = _train_one_grade(grade, datasets[grade], args)
        print(f"Class {grade} model saved at: {model_path}")


if __name__ == "__main__":
    main()
