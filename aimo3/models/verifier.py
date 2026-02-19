"""
Solution Verifier for AIMO3
===========================

Verifier model that scores and ranks solution attempts.
Used to select the best solution from multiple candidates.
"""

import re
from typing import List, Optional, Tuple, Union
from dataclasses import dataclass

import torch
import torch.nn as nn


@dataclass
class VerificationResult:
    """Result of solution verification."""
    score: float
    is_valid: bool
    confidence: float
    error_type: Optional[str] = None
    feedback: Optional[str] = None


class SolutionVerifier:
    """
    Verifier for mathematical solutions.
    
    Can use:
    1. Heuristic-based verification
    2. LLM-based verification (prompting another model)
    3. Trained reward model
    """
    
    def __init__(
        self,
        model=None,
        use_llm_verification: bool = True,
        use_heuristics: bool = True,
        threshold: float = 0.5
    ):
        """
        Initialize the verifier.
        
        Args:
            model: Optional LLM for verification
            use_llm_verification: Whether to use LLM for verification
            use_heuristics: Whether to use heuristic checks
            threshold: Minimum score to consider valid
        """
        self.model = model
        self.use_llm_verification = use_llm_verification
        self.use_heuristics = use_heuristics
        self.threshold = threshold
    
    def score(
        self,
        problem: str,
        solution: str,
        answer: Optional[int]
    ) -> float:
        """
        Score a solution for correctness.
        
        Args:
            problem: Original problem
            solution: Generated solution
            answer: Extracted answer
        
        Returns:
            Score between 0.0 and 1.0
        """
        scores = []
        
        # Heuristic scoring
        if self.use_heuristics:
            h_score = self._heuristic_score(problem, solution, answer)
            scores.append(h_score)
        
        # LLM-based scoring
        if self.use_llm_verification and self.model is not None:
            llm_score = self._llm_score(problem, solution, answer)
            scores.append(llm_score)
        
        if not scores:
            return 0.5  # Default neutral score
        
        return sum(scores) / len(scores)
    
    def verify(
        self,
        problem: str,
        solution: str,
        answer: Optional[int]
    ) -> VerificationResult:
        """
        Full verification with detailed feedback.
        
        Args:
            problem: Original problem
            solution: Generated solution
            answer: Extracted answer
        
        Returns:
            VerificationResult with score and feedback
        """
        score = self.score(problem, solution, answer)
        is_valid = score >= self.threshold
        
        # Generate feedback
        feedback = self._generate_feedback(problem, solution, answer, score)
        error_type = self._detect_error_type(solution, answer) if not is_valid else None
        
        return VerificationResult(
            score=score,
            is_valid=is_valid,
            confidence=abs(score - 0.5) * 2,  # How confident we are in the verdict
            error_type=error_type,
            feedback=feedback
        )
    
    def _heuristic_score(
        self,
        problem: str,
        solution: str,
        answer: Optional[int]
    ) -> float:
        """Heuristic-based scoring."""
        score = 0.5  # Start neutral
        
        # No answer is bad
        if answer is None:
            return 0.1
        
        # Answer out of range
        if not (0 <= answer <= 99999):
            return 0.0
        
        # Check for mathematical reasoning indicators
        reasoning_keywords = [
            'therefore', 'thus', 'hence', 'so', 'because',
            'since', 'given', 'let', 'suppose', 'assume',
            'we have', 'we get', 'we find', 'we obtain'
        ]
        reasoning_count = sum(1 for kw in reasoning_keywords if kw in solution.lower())
        score += min(reasoning_count * 0.05, 0.2)
        
        # Check for mathematical symbols/operations
        math_patterns = [
            r'[+\-*/=]',  # Basic operators
            r'\d+\s*[+\-*/]\s*\d+',  # Operations
            r'\\frac',  # LaTeX fractions
            r'\\sqrt',  # Square root
            r'\^',  # Exponents
        ]
        for pattern in math_patterns:
            if re.search(pattern, solution):
                score += 0.03
        
        # Check for verification/checking
        verification_phrases = [
            'verify', 'check', 'confirm', 'substitute', 'test'
        ]
        if any(phrase in solution.lower() for phrase in verification_phrases):
            score += 0.1
        
        # Check solution length (too short is suspicious)
        if len(solution) < 100:
            score -= 0.2
        elif len(solution) > 500:
            score += 0.1
        
        # Check for boxed answer (proper format)
        if '\\boxed' in solution:
            score += 0.1
        
        # Check answer appears in solution
        if str(answer) in solution:
            score += 0.05
        
        return min(max(score, 0.0), 1.0)
    
    def _llm_score(
        self,
        problem: str,
        solution: str,
        answer: Optional[int]
    ) -> float:
        """LLM-based scoring using the model."""
        if self.model is None:
            return 0.5
        
        verification_prompt = f"""You are a mathematical solution verifier. Analyze the following solution and rate its correctness.

Problem:
{problem}

Solution:
{solution}

Claimed Answer: {answer}

Rate this solution on a scale from 0 to 10, where:
- 0-2: Completely wrong or nonsensical
- 3-4: Has major errors in reasoning
- 5-6: Partially correct but with some errors
- 7-8: Mostly correct with minor issues
- 9-10: Completely correct and well-reasoned

Output ONLY a single number from 0 to 10."""

        try:
            response = self.model.generate(
                verification_prompt,
                max_new_tokens=10,
                temperature=0.1,
                do_sample=False
            )
            
            # Extract number from response
            numbers = re.findall(r'\b(\d+(?:\.\d+)?)\b', response)
            if numbers:
                score = float(numbers[0])
                return min(score / 10.0, 1.0)
        except Exception as e:
            print(f"LLM verification error: {e}")
        
        return 0.5  # Default if verification fails
    
    def _generate_feedback(
        self,
        problem: str,
        solution: str,
        answer: Optional[int],
        score: float
    ) -> str:
        """Generate human-readable feedback."""
        if score >= 0.8:
            return "Solution appears correct and well-reasoned."
        elif score >= 0.6:
            return "Solution has some good reasoning but may have minor issues."
        elif score >= 0.4:
            return "Solution has notable issues - consider regenerating."
        else:
            return "Solution appears incorrect or incomplete."
    
    def _detect_error_type(
        self,
        solution: str,
        answer: Optional[int]
    ) -> Optional[str]:
        """Detect the type of error in the solution."""
        if answer is None:
            return "no_answer_extracted"
        
        if not (0 <= answer <= 99999):
            return "answer_out_of_range"
        
        if len(solution) < 50:
            return "insufficient_reasoning"
        
        if '\\boxed' not in solution and 'answer' not in solution.lower():
            return "missing_final_answer"
        
        return None
    
    def batch_verify(
        self,
        items: List[Tuple[str, str, Optional[int]]]
    ) -> List[VerificationResult]:
        """Verify multiple solutions."""
        results = []
        for problem, solution, answer in items:
            result = self.verify(problem, solution, answer)
            results.append(result)
        return results


class ProcessRewardModel(nn.Module):
    """
    Process Reward Model (PRM) for step-level verification.
    
    This is a trainable model that scores individual reasoning steps,
    used in more advanced RL approaches.
    """
    
    def __init__(
        self,
        base_model,
        hidden_size: int = 4096,
        num_labels: int = 1
    ):
        """
        Initialize the PRM.
        
        Args:
            base_model: Pretrained language model backbone
            hidden_size: Hidden dimension size
            num_labels: Output dimension (1 for regression)
        """
        super().__init__()
        self.base_model = base_model
        self.score_head = nn.Linear(hidden_size, num_labels)
        self.sigmoid = nn.Sigmoid()
    
    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor = None
    ) -> torch.Tensor:
        """
        Forward pass to get step-level scores.
        
        Args:
            input_ids: Tokenized input
            attention_mask: Attention mask
        
        Returns:
            Scores for each step
        """
        outputs = self.base_model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_hidden_states=True
        )
        
        # Use last hidden state
        hidden_states = outputs.hidden_states[-1]
        
        # Score each token position
        scores = self.sigmoid(self.score_head(hidden_states))
        
        return scores
    
    def score_solution(
        self,
        problem: str,
        solution: str,
        tokenizer
    ) -> float:
        """
        Score a complete solution.
        
        Args:
            problem: The problem text
            solution: The solution text
            tokenizer: Tokenizer for the model
        
        Returns:
            Overall solution score
        """
        text = f"Problem: {problem}\n\nSolution: {solution}"
        inputs = tokenizer(text, return_tensors="pt")
        
        with torch.no_grad():
            scores = self.forward(inputs.input_ids, inputs.attention_mask)
        
        # Average score across all positions
        return scores.mean().item()


def create_reward_training_data(
    problems: List[str],
    correct_solutions: List[str],
    incorrect_solutions: List[str]
) -> List[dict]:
    """
    Create training data for the Process Reward Model.
    
    Args:
        problems: List of problems
        correct_solutions: Correct solutions (label=1)
        incorrect_solutions: Incorrect solutions (label=0)
    
    Returns:
        Training data list
    """
    data = []
    
    for problem, solution in zip(problems, correct_solutions):
        data.append({
            "problem": problem,
            "solution": solution,
            "label": 1.0
        })
    
    for problem, solution in zip(problems, incorrect_solutions):
        data.append({
            "problem": problem,
            "solution": solution,
            "label": 0.0
        })
    
    return data
