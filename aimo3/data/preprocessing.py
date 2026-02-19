"""
Data Preprocessing Utilities for AIMO3
======================================

Functions for cleaning, formatting, and preparing math problems for training.
"""

import re
from typing import Dict, List, Optional, Tuple


def preprocess_problem(problem: str) -> str:
    """
    Clean and normalize a math problem text.
    
    Args:
        problem: Raw problem text (may contain LaTeX)
    
    Returns:
        Cleaned problem text
    """
    # Remove extra whitespace
    problem = re.sub(r'\s+', ' ', problem).strip()
    
    # Normalize LaTeX delimiters
    problem = problem.replace('\\[', '$')
    problem = problem.replace('\\]', '$')
    problem = problem.replace('\\(', '$')
    problem = problem.replace('\\)', '$')
    
    # Fix common LaTeX issues
    problem = re.sub(r'\\frac\s*{', r'\\frac{', problem)
    problem = re.sub(r'\\sqrt\s*{', r'\\sqrt{', problem)
    
    return problem


def format_for_training(
    problem: str,
    solution: Optional[str] = None,
    answer: Optional[str] = None,
    model_type: str = "qwen"
) -> str:
    """
    Format a problem-solution pair for fine-tuning.
    
    Args:
        problem: The math problem
        solution: Step-by-step solution
        answer: Final numerical answer
        model_type: Target model format (qwen, llama, mistral)
    
    Returns:
        Formatted training string
    """
    system_prompt = """You are a mathematical reasoning assistant competing in the AI Mathematical Olympiad. 
Your task is to solve competition-level math problems with perfect accuracy.

Guidelines:
1. Think step by step, showing all your reasoning
2. Consider multiple approaches when helpful
3. Verify your answer before finalizing
4. Put your final integer answer in \\boxed{}
5. Answers must be integers between 0 and 99999"""

    if model_type == "qwen":
        if solution:
            return f"""<|im_start|>system
{system_prompt}<|im_end|>
<|im_start|>user
{problem}<|im_end|>
<|im_start|>assistant
{solution}

Therefore, the answer is $\\boxed{{{answer}}}$.<|im_end|>"""
        else:
            return f"""<|im_start|>system
{system_prompt}<|im_end|>
<|im_start|>user
{problem}<|im_end|>
<|im_start|>assistant
"""
    
    elif model_type == "llama":
        if solution:
            return f"""<s>[INST] <<SYS>>
{system_prompt}
<</SYS>>

{problem} [/INST] {solution}

Therefore, the answer is $\\boxed{{{answer}}}$.</s>"""
        else:
            return f"""<s>[INST] <<SYS>>
{system_prompt}
<</SYS>>

{problem} [/INST]"""
    
    elif model_type == "mistral":
        if solution:
            return f"""<s>[INST] {system_prompt}

{problem} [/INST] {solution}

Therefore, the answer is $\\boxed{{{answer}}}$.</s>"""
        else:
            return f"""<s>[INST] {system_prompt}

{problem} [/INST]"""
    
    else:
        # Generic format
        if solution:
            return f"""System: {system_prompt}

User: {problem}