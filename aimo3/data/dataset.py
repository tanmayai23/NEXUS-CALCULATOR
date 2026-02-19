"""
Dataset Loading and Processing for AIMO3
=========================================

Handles loading and processing of math datasets including:
- MATH dataset (Hendrycks)
- GSM8K
- OpenMathReasoning
- Custom datasets
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass

import torch
from torch.utils.data import Dataset


@dataclass
class MathProblem:
    """Represents a single math problem."""
    problem: str
    solution: Optional[str] = None
    answer: Optional[str] = None
    subject: Optional[str] = None
    level: Optional[int] = None
    source: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "problem": self.problem,
            "solution": self.solution,
            "answer": self.answer,
            "subject": self.subject,
            "level": self.level,
            "source": self.source
        }


class MathDataset(Dataset):
    """PyTorch Dataset for math problems."""
    
    def __init__(
        self,
        problems: List[MathProblem],
        tokenizer=None,
        max_length: int = 4096,
        include_solution: bool = True
    ):
        self.problems = problems
        self.tokenizer = tokenizer
        self.max_length = max_length
        self.include_solution = include_solution
    
    def __len__(self) -> int:
        return len(self.problems)
    
    def __getitem__(self, idx: int) -> Dict:
        problem = self.problems[idx]
        
        if self.tokenizer is None:
            return problem.to_dict()
        
        # Format prompt for training
        prompt = self._format_prompt(problem)
        
        # Tokenize
        encoding = self.tokenizer(
            prompt,
            max_length=self.max_length,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        
        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "problem": problem.problem,
            "answer": problem.answer
        }
    
    def _format_prompt(self, problem: MathProblem) -> str:
        """Format problem as a training prompt."""
        system_prompt = """You are a mathematical reasoning assistant. Solve the given problem step by step, showing all your work. Put your final numerical answer in \\boxed{}."""
        
        if self.include_solution and problem.solution:
            return f"""<|system|>
{system_prompt}
<|user|>
{problem.problem}
<|assistant|>
{problem.solution}

The answer is \\boxed{{{problem.answer}}}"""
        else:
            return f"""<|system|>
{system_prompt}
<|user|>
{problem.problem}
<|assistant|>"""


def load_math_dataset(
    split: str = "train",
    subjects: Optional[List[str]] = None,
    max_level: Optional[int] = None
) -> List[MathProblem]:
    """
    Load the MATH dataset from HuggingFace.
    
    Args:
        split: "train" or "test"
        subjects: Filter by subjects (algebra, geometry, etc.)
        max_level: Maximum difficulty level (1-5)
    
    Returns:
        List of MathProblem objects
    """
    try:
        from datasets import load_dataset
        
        dataset = load_dataset("hendrycks/math", split=split)
        problems = []
        
        for item in dataset:
            # Extract subject from type field
            subject = item.get("type", "").lower()
            level = item.get("level", "").replace("Level ", "")
            
            try:
                level_int = int(level) if level else None
            except ValueError:
                level_int = None
            
            # Apply filters
            if subjects and subject not in [s.lower() for s in subjects]:
                continue
            if max_level and level_int and level_int > max_level:
                continue
            
            # Extract answer from solution
            answer = extract_boxed_answer(item.get("solution", ""))
            
            problems.append(MathProblem(
                problem=item["problem"],
                solution=item.get("solution"),
                answer=answer,
                subject=subject,
                level=level_int,
                source="MATH"
            ))
        
        return problems
        
    except ImportError:
        print("Please install datasets: pip install datasets")
        return []
    except Exception as e:
        print(f"Error loading MATH dataset: {e}")
        return []


def load_gsm8k(split: str = "train") -> List[MathProblem]:
    """
    Load GSM8K dataset (grade school math).
    
    Args:
        split: "train" or "test"
    
    Returns:
        List of MathProblem objects
    """
    try:
        from datasets import load_dataset
        
        dataset = load_dataset("gsm8k", "main", split=split)
        problems = []
        
        for item in dataset:
            # GSM8K format: answer is after ####
            answer_match = re.search(r"####\s*(\d+)", item.get("answer", ""))
            answer = answer_match.group(1) if answer_match else None
            
            problems.append(MathProblem(
                problem=item["question"],
                solution=item.get("answer"),
                answer=answer,
                subject="arithmetic",
                level=1,
                source="GSM8K"
            ))
        
        return problems
        
    except ImportError:
        print("Please install datasets: pip install datasets")
        return []
    except Exception as e:
        print(f"Error loading GSM8K dataset: {e}")
        return []


def load_custom_dataset(path: Union[str, Path]) -> List[MathProblem]:
    """
    Load a custom JSON dataset.
    
    Expected format:
    [
        {
            "problem": "...",
            "solution": "...",
            "answer": "..."
        },
        ...
    ]
    """
    path = Path(path)
    problems = []
    
    if path.suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        for item in data:
            problems.append(MathProblem(
                problem=item["problem"],
                solution=item.get("solution"),
                answer=str(item.get("answer", "")),
                subject=item.get("subject"),
                level=item.get("level"),
                source="custom"
            ))
    
    elif path.suffix == ".jsonl":
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                item = json.loads(line)
                problems.append(MathProblem(
                    problem=item["problem"],
                    solution=item.get("solution"),
                    answer=str(item.get("answer", "")),
                    subject=item.get("subject"),
                    level=item.get("level"),
                    source="custom"
                ))
    
    return problems


def extract_boxed_answer(solution: str) -> Optional[str]:
    """Extract the answer from \\boxed{} in a solution."""
    # Try different patterns
    patterns = [
        r"\\boxed{([^}]+)}",  # Standard boxed
        r"\\fbox{([^}]+)}",   # fbox variant
        r"answer is[:\s]+(\d+)",  # "answer is X"
        r"=\s*(\d+)\s*$",  # Ends with = X
    ]
    
    for pattern in patterns:
        match = re.search(pattern, solution, re.IGNORECASE)
        if match:
            answer = match.group(1).strip()
            # Clean up and extract just the number
            number_match = re.search(r"(\d+)", answer)
            if number_match:
                return number_match.group(1)
    
    return None


def combine_datasets(*datasets: List[MathProblem]) -> List[MathProblem]:
    """Combine multiple datasets into one."""
    combined = []
    for dataset in datasets:
        combined.extend(dataset)
    return combined


def split_dataset(
    problems: List[MathProblem],
    train_ratio: float = 0.9
) -> Tuple[List[MathProblem], List[MathProblem]]:
    """Split dataset into train and validation sets."""
    import random
    random.shuffle(problems)
    split_idx = int(len(problems) * train_ratio)
    return problems[:split_idx], problems[split_idx:]
