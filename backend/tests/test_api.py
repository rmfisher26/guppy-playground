"""
Unit tests for compiler and simulator modules.
These test the service layer independently of FastAPI.
"""
from __future__ import annotations
import json
import pytest


# ── Compiler unit tests ────────────────────────────────────────────────────

class TestCompileWorker:
    """Test _compile_worker.py logic directly without subprocess overhead."""

    def test_parse_linearity_error(self):
        from app._compile_worker import parse_guppy_errors

        class FakeExc(Exception):
            pass

        exc = FakeExc("Qubit used after measurement on line 5")
        errors = parse_guppy_errors(exc, "")
        assert len(errors) == 1
        assert errors[0]["kind"] == "linearity_error"
        assert errors[0]["line"] == 5

    def test_parse_type_error(self):
        from app._compile_worker import parse_guppy_errors

        exc = Exception("Expected type int, got bool")
        errors = parse_guppy_errors(exc, "")
        assert errors[0]["kind"] == "type_error"

    def test_parse_name_error(self):
        from app._compile_worker import parse_guppy_errors

        exc = NameError("name 'qubit' is not defined")
        errors = parse_guppy_errors(exc, "")
        assert errors[0]["kind"] == "name_error"

    def test_infer_nodes_bell(self):
        from app._compile_worker import infer_nodes_from_source

        source = """\
from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure

@guppy
def bell_pair() -> tuple[bool, bool]:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    return measure(q0), measure(q1)

bell_pair.check()
"""
        nodes = infer_nodes_from_source(source)
        types = {n["type"] for n in nodes}
        assert "FuncDef" in types
        assert "Gate" in types
        assert "Measure" in types

    def test_infer_nodes_returns_list_of_dicts(self):
        from app._compile_worker import infer_nodes_from_source
        nodes = infer_nodes_from_source("@guppy\ndef foo() -> None:\n    pass\n")
        assert isinstance(nodes, list)
        for n in nodes:
            assert "id"    in n
            assert "type"  in n
            assert "name"  in n
            assert "depth" in n


# ── Sandbox unit tests ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_sandbox_runs_python():
    from app.sandbox import run_subprocess
    import sys

    result = await run_subprocess(
        [sys.executable, "-c", "print('hello')"],
    )
    assert result.returncode == 0
    assert "hello" in result.stdout
    assert not result.timed_out


@pytest.mark.asyncio
async def test_sandbox_timeout():
    from app.sandbox import run_subprocess
    import sys

    result = await run_subprocess(
        [sys.executable, "-c", "import time; time.sleep(60)"],
        timeout=0.5,
    )
    assert result.timed_out
    assert result.returncode == -1


@pytest.mark.asyncio
async def test_sandbox_captures_stderr():
    from app.sandbox import run_subprocess
    import sys

    result = await run_subprocess(
        [sys.executable, "-c", "import sys; sys.stderr.write('err')"],
    )
    assert "err" in result.stderr


@pytest.mark.asyncio
async def test_sandbox_stdin():
    from app.sandbox import run_subprocess
    import sys

    result = await run_subprocess(
        [sys.executable, "-c", "import sys; print(sys.stdin.read().strip())"],
        input_data="hello from stdin",
    )
    assert "hello from stdin" in result.stdout


# ── Models unit tests ──────────────────────────────────────────────────────

def test_run_request_shot_validation():
    from app.models import RunRequest
    from pydantic import ValidationError

    # Valid
    req = RunRequest(source="x", shots=1024, simulator="stabilizer")
    assert req.shots == 1024

    # Too many shots
    with pytest.raises(ValidationError):
        RunRequest(source="x", shots=99999, simulator="stabilizer")

    # Too few shots
    with pytest.raises(ValidationError):
        RunRequest(source="x", shots=0, simulator="stabilizer")


def test_run_response_serialises():
    from app.models import RunResponse, RunStatus
    resp = RunResponse(status=RunStatus.ok)
    data = resp.model_dump()
    assert data["status"] == "ok"
    assert data["compile"] is None
    assert data["results"] is None


def test_compile_error_kind_enum():
    from app.models import CompileError, ErrorKind
    err = CompileError(message="test", line=1, kind=ErrorKind.linearity_error)
    assert err.kind == ErrorKind.linearity_error
    data = err.model_dump()
    assert data["kind"] == "linearity_error"
