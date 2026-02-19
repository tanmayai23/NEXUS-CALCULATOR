"""
Math Problem Inference Engine for AIMO3
=======================================

Core inference logic for solving math problems with:
- Multi-sample generation
- Chain-of-thought reasoning
- Answer extraction
- Majority voting
"""

import re
import time
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass


@dataclass
class SolutionAttempt:
    """Represents a single solution attempt."""
    solution: str
    answer: Optional[int]
    confidence: float = 0.0
    reasoning_length: int = 0
    generation_time: float = 0.0


@dataclass
class SolverResult:
    """Result from the math solver."""
    answer: int
    confidence: float
    best_solution: str
    all_attempts: List[SolutionAttempt]
    total_time: float
    method: str  # "majority_vote", "highest_confidence", "single"


class MathSolver:
    """
    Main solver class for AIMO3 competition.
    
    Implements multi-sample reasoning, majority voting,
    and test-time compute scaling.
    """
    
    def __init__(
        self,
        model=None,
        model_name: str = "Qwen/Qwen2.5-Math-7B-Instruct",
        verifier=None,
        num_samples: int = 8,
        temperature_range: Tuple[float, float] = (0.5, 1.0),
        max_new_tokens: int = 4096,
        use_majority_vote: bool = True,
        time_budget: int = 300,
    ):
        self.model = model
        self.model_name = model_name
        self.verifier = verifier
        self.num_samples = num_samples
        self.temperature_range = temperature_range
        self.max_new_tokens = max_new_tokens
        self.use_majority_vote = use_majority_vote
        self.time_budget = time_budget
        self._model_loaded = model is not None
    
    def _ensure_model_loaded(self):
        """Load model if not already loaded."""
        if not self._model_loaded:
            from .base import load_model
            self.model = load_model(self.model_name)
            self._model_loaded = True
    
    def solve(
        self,
        problem: str,
        num_samples: Optional[int] = None,
        time_budget: Optional[int] = None
    ) -> SolverResult:
        """Solve a math problem."""
        self._ensure_model_loaded()
        
        num_samples = num_samples or self.num_samples
        time_budget = time_budget or self.time_budget
        
        start_time = time.time()
        attempts = []
        
        for i in range(num_samples):
            if time.time() - start_time > time_budget * 0.9:
                break
            
            temperature = random.uniform(*self.temperature_range)
            
            try:
                attempt = self._generate_solution(problem, temperature)
                if attempt.answer is not None:
                    attempts.append(attempt)
            except Exception as e:
                print(f"Generation error: {e}")
                continue
        
        total_time = time.time() - start_time
        
        if not attempts:
            return SolverResult(
                answer=0,
                confidence=0.0,
                best_solution="Failed to generate valid solution",
                all_attempts=[],
                total_time=total_time,
                method="fallback"
            )
        
        if self.use_majority_vote and len(attempts) > 1:
            result = self._majority_vote(attempts, total_time)
        elif self.verifier and len(attempts) > 1:
            result = self._verifier_ranking(attempts, problem, total_time)
        else:
            best = max(attempts, key=lambda x: x.confidence)
            result = SolverResult(
                answer=best.answer,
                confidence=best.confidence,
                best_solution=best.solution,
                all_attempts=attempts,
                total_time=total_time,
                method="single"
            )
        
        return result
    
    def _generate_solution(self, problem: str, temperature: float) -> SolutionAttempt:
        """Generate a single solution attempt."""
        start_time = time.time()
        prompt = self._create_prompt(problem)
        
        solution = self.model.generate(
            prompt,
            max_new_tokens=self.max_new_tokens,
            temperature=temperature,
            top_p=0.95,
            do_sample=True
        )
        
        generation_time = time.time() - start_time
        answer = self._extract_answer(solution)
        confidence = self._estimate_confidence(solution, answer)
        
        return SolutionAttempt(
            solution=solution,
            answer=answer,
            confidence=confidence,
            reasoning_length=len(solution),
            generation_time=generation_time
        )
    
    def _create_prompt(self, problem: str) -> str:
        """Create the inference prompt."""
        system_prompt = """You are a mathematical reasoning assistant competing in the AI Mathematical Olympiad.

Your task:
1. Solve the given problem step by step
2. Show all your work and reasoning
3. Consider multiple approaches if helpful
4. Verify your answer
5. Put your FINAL INTEGER ANSWER in \\boxed{}

Important: The answer MUST be a non-negative integer between 0 and 99999."""

        model_name_lower = self.model_name.lower()
        
        if "qwen" in model_name_lower:
            return f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{problem}<|im_end|>\n<|im_start|>assistant\nLet me solve this step by step.\n\n"
        elif "llama" in model_name_lower:
            return f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n{problem} [/INST] Let me solve this step by step.\n\n"
        elif "mistral" in model_name_lower:
            return f"<s>[INST] {system_prompt}\n\n{problem} [/INST] Let me solve this step by step.\n\n"
        else:
            return f"System: {system_prompt}\n\nUser: {problem}\n\nAssistant: Let me solve this step by step.\n\n"
    
    def _extract_answer(self, solution: str) -> Optional[int]:
        """Extract the numerical answer from a solution."""
        patterns = [
            r"\\boxed{(\d+)}",
            r"\\boxed\{(\d+)\}",
            r"boxed{(\d+)}",
            r"\$\\boxed{(\d+)}\$",
            r"answer is[:\s]+(\d+)",
            r"answer[:\s]+(\d+)",
            r"= (\d+)$",
            r"(\d+)\s*$",
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, solution, re.IGNORECASE | re.MULTILINE)
            if matches:
                try:
                    answer = int(matches[-1])
                    if 0 <= answer <= 99999:
                        return answer
                except ValueError:
                    continue
        
        numbers = re.findall(r'\b(\d+)\b', solution)
        if numbers:
            try:
                answer = int(numbers[-1])
                if 0 <= answer <= 99999:
                    return answer
            except ValueError:
                pass
        
        return None
    
    def _estimate_confidence(self, solution: str, answer: Optional[int]) -> float:
        """Estimate confidence based on solution quality."""
        if answer is None:
            return 0.0
        
        confidence = 0.5
        
        # Longer reasoning generally better (up to a point)
        length_score = min(len(solution) / 2000, 1.0) * 0.2
        confidence += length_score
        
        # Check for verification phrases
        verification_phrases = [
            "let me verify", "checking", "verification",
            "to confirm", "double-check", "substituting back"
        ]
        if any(phrase in solution.lower() for phrase in verification_phrases):
            confidence += 0.1
        
        # Check for structured reasoning
        structure_indicators = ["step 1", "first", "therefore", "thus", "hence", "so we have"]
        if sum(1 for ind in structure_indicators if ind in solution.lower()) >= 2:
            confidence += 0.1
        
        # Penalize very short solutions
        if len(solution) < 200:
            confidence -= 0.2
        
        # Check for boxed answer (proper format)
        if "\\boxed" in solution:
            confidence += 0.1
        
        return min(max(confidence, 0.0), 1.0)
    
    def _majority_vote(self, attempts: List[SolutionAttempt], total_time: float) -> SolverResult:
        """Use majority voting to determine the answer."""
        answers = [a.answer for a in attempts if a.answer is not None]
        
        if not answers:
            return SolverResult(
                answer=0,
                confidence=0.0,
                best_solution="No valid answers found",
                all_attempts=attempts,
                total_time=total_time,
                method="majority_vote_failed"
            )
        
        counter = Counter(answers)
        most_common = counter.most_common(1)[0]
        winning_answer = most_common[0]
        vote_count = most_common[1]
        
        confidence = vote_count / len(answers)
        
        # Find best solution with winning answer
        winning_attempts = [a for a in attempts if a.answer == winning_answer]
        best_solution = max(winning_attempts, key=lambda x: x.confidence).solution
        
        return SolverResult(
            answer=winning_answer,
            confidence=confidence,
            best_solution=best_solution,
            all_attempts=attempts,
            total_time=total_time,
            method="majority_vote"
        )
    
    def _verifier_ranking(
        self,
        attempts: List[SolutionAttempt],
        problem: str,
        total_time: float
    ) -> SolverResult:
        """Use a verifier model to rank solutions."""
        if self.verifier is None:
            return self._majority_vote(attempts, total_time)
        
        scored_attempts = []
        for attempt in attempts:
            score = self.verifier.score(problem, attempt.solution, attempt.answer)
            scored_attempts.append((attempt, score))
        
        best_attempt, best_score = max(scored_attempts, key=lambda x: x[1])
        
        return SolverResult(
            answer=best_attempt.answer,
            confidence=best_score,
            best_solution=best_attempt.solution,
            all_attempts=attempts,
            total_time=total_time,
            method="verifier_ranking"
        )
    
    def solve_batch(
        self,
        problems: List[str],
        progress_callback=None
    ) -> List[SolverResult]:
        """Solve multiple problems."""
        results = []
        for i, problem in enumerate(problems):
            result = self.solve(problem)
            results.append(result)
            if progress_callback:
                progress_callback(i + 1, len(problems), result)
        return results


def extract_final_answer(text: str) -> Optional[int]:
    """Utility function to extract answer from any text."""
    solver = MathSolver.__new__(MathSolver)
    return solver._extract_answer(text)
