#!/usr/bin/env python
"""
AIMO3 Solver API Script
=======================

Called by the Node.js backend to solve math problems.
"""

import sys
import json
import argparse
from typing import Optional

# Add parent directory to path
sys.path.insert(0, str(__file__).replace('\\', '/').rsplit('/', 2)[0])


def solve_problem_simple(problem: str) -> dict:
    """
    Simple solver that doesn't require GPU.
    Uses rule-based approaches for common problem types.
    """
    import re
    import math
    
    result = {
        "answer": 0,
        "solution": "",
        "confidence": 0.5,
        "method": "rule-based"
    }
    
    problem_lower = problem.lower()
    
    # Pattern: remainder when a^b divided by c
    remainder_pattern = r"remainder.*?(\d+)\s*\^\s*{?(\d+)}?\s*.*?divided by\s*(\d+)"
    match = re.search(remainder_pattern, problem_lower)
    if match:
        base, exp, mod = int(match.group(1)), int(match.group(2)), int(match.group(3))
        answer = pow(base, exp, mod)
        result["answer"] = answer
        result["solution"] = f"Using modular exponentiation: {base}^{exp} mod {mod} = {answer}"
        result["confidence"] = 0.9
        return result
    
    # Pattern: factorial
    factorial_pattern = r"(\d+)!"
    if "factorial" in problem_lower or re.search(factorial_pattern, problem):
        match = re.search(factorial_pattern, problem)
        if match:
            n = int(match.group(1))
            if n <= 20:  # Reasonable range
                answer = math.factorial(n)
                if 0 <= answer <= 99999:
                    result["answer"] = answer
                    result["solution"] = f"{n}! = {answer}"
                    result["confidence"] = 0.9
                    return result
    
    # Pattern: GCD/HCF
    gcd_pattern = r"(?:gcd|hcf|greatest common divisor).*?(\d+).*?(\d+)"
    match = re.search(gcd_pattern, problem_lower)
    if match:
        a, b = int(match.group(1)), int(match.group(2))
        answer = math.gcd(a, b)
        result["answer"] = answer
        result["solution"] = f"GCD({a}, {b}) = {answer}"
        result["confidence"] = 0.9
        return result
    
    # Pattern: LCM
    lcm_pattern = r"(?:lcm|least common multiple).*?(\d+).*?(\d+)"
    match = re.search(lcm_pattern, problem_lower)
    if match:
        a, b = int(match.group(1)), int(match.group(2))
        answer = (a * b) // math.gcd(a, b)
        if 0 <= answer <= 99999:
            result["answer"] = answer
            result["solution"] = f"LCM({a}, {b}) = {answer}"
            result["confidence"] = 0.9
            return result
    
    # Pattern: sum of first n numbers
    sum_pattern = r"sum.*?first\s*(\d+)\s*(?:positive\s*)?(?:integers?|numbers?)"
    match = re.search(sum_pattern, problem_lower)
    if match:
        n = int(match.group(1))
        answer = n * (n + 1) // 2
        if 0 <= answer <= 99999:
            result["answer"] = answer
            result["solution"] = f"Sum of first {n} integers = n(n+1)/2 = {answer}"
            result["confidence"] = 0.9
            return result
    
    # Pattern: binomial coefficient C(n,k)
    binom_pattern = r"(?:c\(|choose|binomial).*?(\d+).*?(\d+)"
    match = re.search(binom_pattern, problem_lower)
    if match:
        n, k = int(match.group(1)), int(match.group(2))
        if k <= n:
            from math import comb
            answer = comb(n, k)
            if 0 <= answer <= 99999:
                result["answer"] = answer
                result["solution"] = f"C({n},{k}) = {answer}"
                result["confidence"] = 0.9
                return result
    
    result["solution"] = "Could not solve with rule-based methods. Please use GPU model."
    result["confidence"] = 0.1
    
    return result


def solve_problem_with_model(
    problem: str,
    num_samples: int = 4,
    time_budget: int = 120,
    model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct"
) -> dict:
    """
    Solve using the full ML model (requires GPU).
    """
    try:
        from models.inference import MathSolver
        from models.base import load_model
        
        # Load model
        model = load_model(model_name)
        
        # Create solver
        solver = MathSolver(
            model=model,
            model_name=model_name,
            num_samples=num_samples,
            time_budget=time_budget,
            use_majority_vote=True
        )
        
        # Solve
        result = solver.solve(problem)
        
        return {
            "answer": result.answer,
            "solution": result.best_solution,
            "confidence": result.confidence,
            "method": result.method,
            "total_time": result.total_time,
            "num_attempts": len(result.all_attempts)
        }
        
    except ImportError as e:
        # Fall back to simple solver if model not available
        print(f"Model not available: {e}", file=sys.stderr)
        return solve_problem_simple(problem)
    except Exception as e:
        print(f"Error with model: {e}", file=sys.stderr)
        return solve_problem_simple(problem)


def main():
    parser = argparse.ArgumentParser(description='AIMO3 Math Problem Solver')
    parser.add_argument('--problem', type=str, required=True, help='Math problem to solve')
    parser.add_argument('--num_samples', type=int, default=4, help='Number of solution samples')
    parser.add_argument('--time_budget', type=int, default=120, help='Time budget in seconds')
    parser.add_argument('--model', type=str, default='simple', help='Model to use (simple or model name)')
    parser.add_argument('--use_gpu', action='store_true', help='Use GPU model')
    
    args = parser.parse_args()
    
    if args.use_gpu or args.model != 'simple':
        result = solve_problem_with_model(
            args.problem,
            args.num_samples,
            args.time_budget,
            args.model if args.model != 'simple' else "Qwen/Qwen2.5-Math-7B-Instruct"
        )
    else:
        result = solve_problem_simple(args.problem)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == "__main__":
    main()
