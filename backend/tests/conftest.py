"""Shared pytest fixtures for the backend test suite."""
from __future__ import annotations
import pathlib
import pytest

PROGRAMS_DIR = pathlib.Path(__file__).parent / "programs"


@pytest.fixture
def load_program():
    """Return a callable that reads a .py file from tests/programs/ by stem name.

    Usage:
        def test_foo(load_program):
            source = load_program("bell_pair")   # reads bell_pair.py
    """
    def _load(name: str) -> str:
        path = PROGRAMS_DIR / f"{name}.py"
        if not path.exists():
            raise FileNotFoundError(f"No program file: {path}")
        return path.read_text()
    return _load
