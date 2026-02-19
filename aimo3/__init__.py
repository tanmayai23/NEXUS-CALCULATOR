# AIMO3 - AI Mathematical Olympiad Progress Prize 3
# Competition Solution Pipeline

"""
AIMO3 Competition Solution
==========================

This module provides a complete pipeline for the AI Mathematical Olympiad
Progress Prize 3 competition on Kaggle.

Components:
- data/: Data loading, preprocessing, and dataset management
- models/: Model loading, inference, and fine-tuning
- inference/: Solution generation with CoT and verification
- training/: Fine-tuning scripts for LoRA/PEFT
- utils/: Utility functions and helpers
- kaggle/: Kaggle submission notebook templates

Usage:
    from aimo3 import MathSolver
    
    solver = MathSolver(model_name="Qwen/Qwen2.5-Math-72B-Instruct")
    answer = solver.solve("What is the remainder when 2^100 is divided by 7?")
"""

__version__ = "1.0.0"
__author__ = "TANMAYKALA"
