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
        from app._compile_worker import _parse_error

        class FakeExc(Exception):
            pass

        exc = FakeExc("Qubit used after measurement on line 5")
        errors = _parse_error(exc, "", "")
        assert len(errors) == 1
        assert errors[0]["kind"] == "linearity_error"
        assert errors[0]["line"] == 5

    def test_parse_type_error(self):
        from app._compile_worker import _parse_error

        exc = Exception("Expected type int, got bool")
        errors = _parse_error(exc, "", "")
        assert errors[0]["kind"] == "type_error"

    def test_parse_name_error(self):
        from app._compile_worker import _parse_error

        exc = NameError("name 'foo' is not defined")
        errors = _parse_error(exc, "", "")
        assert errors[0]["kind"] == "name_error"

    def test_infer_nodes_bell(self):
        from app._compile_worker import _infer_nodes

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
        nodes = _infer_nodes(source)
        types = {n["type"] for n in nodes}
        assert "FuncDef" in types
        assert "Gate" in types
        assert "Measure" in types

    def test_infer_nodes_returns_list_of_dicts(self):
        from app._compile_worker import _infer_nodes
        nodes = _infer_nodes("@guppy\ndef foo() -> None:\n    pass\n")
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


def test_simulator_backend_enum_values():
    from app.models import SimulatorBackend
    assert SimulatorBackend.stabilizer == "stabilizer"
    assert SimulatorBackend.statevector == "statevector"


def test_run_request_seed_is_optional():
    from app.models import RunRequest
    req = RunRequest(source="x", simulator="stabilizer")
    assert req.seed is None
    assert req.shots == 1024  # default


def test_run_request_invalid_simulator():
    from app.models import RunRequest
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        RunRequest(source="x", simulator="not_real")


# ── Config unit tests ──────────────────────────────────────────────────────

def test_allowed_origins_json_array():
    from app.config import Settings
    s = Settings(allowed_origins='["http://localhost:4321","https://pond.guppyfisher.dev"]')
    assert s.origins_list == ["http://localhost:4321", "https://pond.guppyfisher.dev"]


def test_allowed_origins_comma_separated():
    from app.config import Settings
    s = Settings(allowed_origins="http://localhost:4321,https://pond.guppyfisher.dev")
    assert s.origins_list == ["http://localhost:4321", "https://pond.guppyfisher.dev"]


def test_allowed_origins_single_value():
    from app.config import Settings
    s = Settings(allowed_origins="http://localhost:4321")
    assert s.origins_list == ["http://localhost:4321"]


# ── Compiler unit tests (error paths) ─────────────────────────────────────

@pytest.mark.asyncio
async def test_compiler_timeout_returns_error():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    from app.models import ErrorKind

    timed_out = SubprocessResult(stdout="", stderr="timed out", returncode=-1, timed_out=True)
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=timed_out)):
        result = await compile_and_simulate("x", shots=1, simulator="stabilizer")
    assert isinstance(result, list)
    assert result[0].kind == ErrorKind.internal_error
    assert "timed out" in result[0].message.lower()


@pytest.mark.asyncio
async def test_compiler_empty_stdout_returns_error():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    from app.models import ErrorKind

    empty = SubprocessResult(stdout="", stderr="something crashed", returncode=1, timed_out=False)
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=empty)):
        result = await compile_and_simulate("x", shots=1, simulator="stabilizer")
    assert isinstance(result, list)
    assert result[0].kind == ErrorKind.internal_error


@pytest.mark.asyncio
async def test_compiler_bad_json_returns_error():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    from app.models import ErrorKind

    bad_json = SubprocessResult(stdout="not json {{", stderr="", returncode=0, timed_out=False)
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=bad_json)):
        result = await compile_and_simulate("x", shots=1, simulator="stabilizer")
    assert isinstance(result, list)
    assert result[0].kind == ErrorKind.internal_error
