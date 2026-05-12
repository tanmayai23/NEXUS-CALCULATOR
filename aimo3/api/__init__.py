# API module
try:  # best-effort re-exports; never break package import
    from .solve import solve_problem  # noqa: F401
except Exception:  # pragma: no cover
    solve_problem = None  # type: ignore

try:
    from . import knowledge  # noqa: F401
except Exception:  # pragma: no cover
    knowledge = None  # type: ignore

__all__ = ["solve_problem", "knowledge"]
