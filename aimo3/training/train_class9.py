"""Train a chapter-aware Class 9 NCERT math model using LoRA."""

import argparse
from pathlib import Path

from data.class9_training_builder import build_class9_training_data
from training.trainer import train_math_model


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Class 9 NCERT model")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-Math-7B-Instruct")
    parser.add_argument("--output", type=str, default="./outputs/class9_ncert")
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max_seq_length", type=int, default=2048)
    parser.add_argument("--build_only", action="store_true", help="Only build dataset, do not train")

    args = parser.parse_args()

    dataset_path = Path(__file__).resolve().parents[1] / "data" / "class9_training_data.json"
    train_data = build_class9_training_data(output_path=dataset_path)
    print(f"Built dataset with {len(train_data)} examples at: {dataset_path}")

    if args.build_only:
        return

    model_path = train_math_model(
        train_data=train_data,
        model_name=args.model,
        output_dir=args.output,
        num_epochs=args.epochs,
        learning_rate=args.lr,
        max_seq_length=args.max_seq_length,
    )

    print(f"Class 9 model saved at: {model_path}")


if __name__ == "__main__":
    main()
