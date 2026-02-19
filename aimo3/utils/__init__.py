"""
Utility Functions for AIMO3
===========================

Helper functions for various tasks.
"""

import re
import math
import sympy
from typing import List, Optional, Tuple, Union


def is_valid_answer(answer: int) -> bool:
    """Check if answer is in valid range."""
    return isinstance(answer, int) and 0 <= answer <= 99999


def clean_latex(text: str) -> str:
    """Clean and normalize LaTeX text."""
    # Remove display math delimiters
    text = re.sub(r'\\\[|\\\]', '$', text)
    text = re.sub(r'\\\(|\\\)', '$', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text


def extract_numbers(text: str) -> List[int]:
    """Extract all integers from text."""
    return [int(x) for x in re.findall(r'\b(\d+)\b', text)]


def modular_exponentiation(base: int, exp: int, mod: int) -> int:
    """
    Efficient modular exponentiation.
    
    Computes (base^exp) % mod efficiently.
    """
    result = 1
    base = base % mod
    
    while exp > 0:
        if exp % 2 == 1:
            result = (result * base) % mod
        exp = exp >> 1
        base = (base * base) % mod
    
    return result


def gcd(a: int, b: int) -> int:
    """Greatest common divisor."""
    while b:
        a, b = b, a % b
    return a


def lcm(a: int, b: int) -> int:
    """Least common multiple."""
    return abs(a * b) // gcd(a, b)


def is_prime(n: int) -> bool:
    """Check if n is prime."""
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    for i in range(3, int(math.sqrt(n)) + 1, 2):
        if n % i == 0:
            return False
    return True


def prime_factorization(n: int) -> dict:
    """Return prime factorization as {prime: exponent}."""
    factors = {}
    d = 2
    while d * d <= n:
        while n % d == 0:
            factors[d] = factors.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        factors[n] = factors.get(n, 0) + 1
    return factors


def euler_totient(n: int) -> int:
    """Euler's totient function φ(n)."""
    result = n
    p = 2
    while p * p <= n:
        if n % p == 0:
            while n % p == 0:
                n //= p
            result -= result // p
        p += 1
    if n > 1:
        result -= result // n
    return result


def solve_linear_congruence(a: int, b: int, m: int) -> Optional[int]:
    """
    Solve ax ≡ b (mod m).
    
    Returns smallest non-negative solution, or None if no solution.
    """
    g = gcd(a, m)
    if b % g != 0:
        return None
    
    a, b, m = a // g, b // g, m // g
    
    # Extended Euclidean algorithm
    def extended_gcd(a, b):
        if a == 0:
            return b, 0, 1
        gcd, x1, y1 = extended_gcd(b % a, a)
        x = y1 - (b // a) * x1
        y = x1
        return gcd, x, y
    
    _, x, _ = extended_gcd(a, m)
    return (x * b) % m


def chinese_remainder_theorem(
    remainders: List[int],
    moduli: List[int]
) -> Optional[int]:
    """
    Chinese Remainder Theorem.
    
    Solve system of congruences:
    x ≡ r[0] (mod m[0])
    x ≡ r[1] (mod m[1])
    ...
    
    Returns smallest non-negative solution.
    """
    if len(remainders) != len(moduli):
        return None
    
    M = 1
    for m in moduli:
        M *= m
    
    x = 0
    for r, m in zip(remainders, moduli):
        Mi = M // m
        yi = pow(Mi, -1, m)  # Python 3.8+
        x += r * Mi * yi
    
    return x % M


def binomial(n: int, k: int) -> int:
    """Binomial coefficient C(n, k)."""
    if k < 0 or k > n:
        return 0
    if k == 0 or k == n:
        return 1
    
    k = min(k, n - k)
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result


def factorial(n: int) -> int:
    """Factorial n!"""
    if n < 0:
        return 0
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result


def solve_quadratic(a: float, b: float, c: float) -> Tuple[Optional[float], Optional[float]]:
    """
    Solve ax² + bx + c = 0.
    
    Returns tuple of solutions (may be None if no real solutions).
    """
    discriminant = b * b - 4 * a * c
    
    if discriminant < 0:
        return None, None
    elif discriminant == 0:
        x = -b / (2 * a)
        return x, x
    else:
        sqrt_d = math.sqrt(discriminant)
        x1 = (-b + sqrt_d) / (2 * a)
        x2 = (-b - sqrt_d) / (2 * a)
        return x1, x2


def format_solution(
    steps: List[str],
    final_answer: int,
    include_box: bool = True
) -> str:
    """
    Format a solution with steps and boxed answer.
    
    Args:
        steps: List of solution steps
        final_answer: The final integer answer
        include_box: Whether to include \\boxed{}
    
    Returns:
        Formatted solution string
    """
    solution = "\n\n".join(steps)
    
    if include_box:
        solution += f"\n\nTherefore, the answer is $\\boxed{{{final_answer}}}$."
    else:
        solution += f"\n\nThe answer is {final_answer}."
    
    return solution


# Symbolic math helpers using SymPy
def symbolic_solve(equation_str: str, variable: str = "x") -> Optional[int]:
    """
    Try to solve an equation symbolically.
    
    Args:
        equation_str: Equation as string (e.g., "x**2 - 4 = 0")
        variable: Variable to solve for
    
    Returns:
        Integer solution if found, None otherwise
    """
    try:
        x = sympy.Symbol(variable)
        
        # Parse equation
        if "=" in equation_str:
            left, right = equation_str.split("=")
            equation = sympy.sympify(left) - sympy.sympify(right)
        else:
            equation = sympy.sympify(equation_str)
        
        solutions = sympy.solve(equation, x)
        
        # Return first integer solution in valid range
        for sol in solutions:
            if sol.is_integer:
                int_sol = int(sol)
                if is_valid_answer(int_sol):
                    return int_sol
        
        return None
    except Exception:
        return None
