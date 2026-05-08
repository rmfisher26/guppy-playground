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


# ── Noise model model tests ────────────────────────────────────────────────

class TestNoiseModelValidation:
    def test_noise_model_defaults_to_none(self):
        from app.models import RunRequest
        req = RunRequest(source="x", simulator="stabilizer")
        assert req.noise_model is None

    def test_noise_model_depolarizing_accepted(self):
        from app.models import RunRequest, NoiseModelKind
        req = RunRequest(source="x", simulator="stabilizer", noise_model="depolarizing")
        assert req.noise_model == NoiseModelKind.depolarizing

    def test_error_rate_default(self):
        from app.models import RunRequest
        req = RunRequest(source="x", simulator="stabilizer")
        assert req.error_rate == 0.001

    def test_error_rate_clamped_at_zero(self):
        from app.models import RunRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RunRequest(source="x", simulator="stabilizer", error_rate=-0.1)

    def test_error_rate_clamped_at_one(self):
        from app.models import RunRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RunRequest(source="x", simulator="stabilizer", error_rate=1.5)

    def test_invalid_noise_model_rejected(self):
        from app.models import RunRequest
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            RunRequest(source="x", simulator="stabilizer", noise_model="bit_flip_doesnt_exist")


class TestSimulationResultsNoisyField:
    def test_noisy_counts_absent_by_default(self):
        from app.models import SimulationResults
        r = SimulationResults(counts={"00": 512, "11": 512}, simulate_time_ms=10)
        assert r.noisy_counts is None
        assert r.model_dump()["noisy_counts"] is None

    def test_noisy_counts_present_when_set(self):
        from app.models import SimulationResults
        r = SimulationResults(
            counts={"00": 512, "11": 512},
            noisy_counts={"00": 480, "11": 510, "01": 22, "10": 12},
            simulate_time_ms=20,
        )
        assert r.noisy_counts is not None
        assert sum(r.noisy_counts.values()) == 1024


# ── Flatten counts unit test ───────────────────────────────────────────────

def test_flatten_counts_helper():
    from app._compile_worker import _flatten_counts

    class FakeShot:
        def __init__(self, entries):
            self.entries = entries

    class FakeResult:
        def __init__(self, shots):
            self.results = [FakeShot(s) for s in shots]

    result = FakeResult([
        [("q", False), ("q", False)],   # 00
        [("q", True),  ("q", True)],    # 11
        [("q", False), ("q", False)],   # 00
    ])
    counts = _flatten_counts(result)
    assert counts == {"00": 2, "11": 1}


def test_flatten_counts_array_register():
    from app._compile_worker import _flatten_counts

    class FakeShot:
        def __init__(self, entries):
            self.entries = entries

    class FakeResult:
        def __init__(self, shots):
            self.results = [FakeShot(s) for s in shots]

    result = FakeResult([
        [("q", [True, False, True])],   # 101
        [("q", [False, False, False])], # 000
    ])
    counts = _flatten_counts(result)
    assert counts == {"101": 1, "000": 1}


# ── Compiler passes noise params through ───────────────────────────────────

@pytest.mark.asyncio
async def test_compiler_passes_noise_params():
    from unittest.mock import AsyncMock, patch, call
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    import json as _json

    worker_ok = SubprocessResult(
        stdout=_json.dumps({
            "status": "ok", "counts": {"00": 64}, "noisy_counts": {"00": 60, "01": 4},
            "hugr_nodes": [], "hugr_json": None, "warnings": [], "qubit_count": 2,
        }),
        stderr="", returncode=0, timed_out=False,
    )
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=worker_ok)) as mock_sub:
        result = await compile_and_simulate(
            "x", shots=64, simulator="stabilizer",
            noise_model="depolarizing", error_rate=0.01,
        )

    # Verify noise params were included in the stdin JSON sent to the worker
    called_input = mock_sub.call_args.kwargs["input_data"]
    payload = _json.loads(called_input)
    assert payload["noise_model"] == "depolarizing"
    assert payload["error_rate"] == 0.01

    # Verify noisy_counts surfaced in the result
    assert not isinstance(result, list)
    compile_ok, sim_ok = result
    assert sim_ok.noisy_counts == {"00": 60, "01": 4}


@pytest.mark.asyncio
async def test_compiler_no_noise_model_sends_none():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    import json as _json

    worker_ok = SubprocessResult(
        stdout=_json.dumps({
            "status": "ok", "counts": {"00": 64}, "noisy_counts": None,
            "hugr_nodes": [], "hugr_json": None, "warnings": [], "qubit_count": 2,
        }),
        stderr="", returncode=0, timed_out=False,
    )
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=worker_ok)) as mock_sub:
        result = await compile_and_simulate("x", shots=64, simulator="stabilizer")

    payload = _json.loads(mock_sub.call_args.kwargs["input_data"])
    assert payload["noise_model"] is None

    compile_ok, sim_ok = result
    assert sim_ok.noisy_counts is None


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


# ── _extract_register_names unit tests ────────────────────────────────────────

class _FakeShot:
    """Minimal QsysShot stand-in: returns a fixed to_register_bits dict."""
    def __init__(self, reg_bits: dict):
        self._reg_bits = reg_bits

    def to_register_bits(self):
        return self._reg_bits


class _FakeResult:
    def __init__(self, shots):
        self.results = [_FakeShot(s) for s in shots]


class TestExtractRegisterNames:
    def test_scalar_registers(self):
        """Single-bit named registers produce a flat name list."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"m0": "0", "m1": "1"}])
        assert _extract_register_names(result) == ["m0", "m1"]

    def test_array_register_expands_to_indexed_names(self):
        """Multi-bit register 'q' with 3 bits → ['q[0]', 'q[1]', 'q[2]']."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"q": "011"}])
        assert _extract_register_names(result) == ["q[0]", "q[1]", "q[2]"]

    def test_five_qubit_array_ghz(self):
        """5-qubit GHZ-style register produces 5 indexed names."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"q": "00000"}])
        assert _extract_register_names(result) == ["q[0]", "q[1]", "q[2]", "q[3]", "q[4]"]

    def test_multiple_named_array_registers(self):
        """Two named array registers are each expanded independently."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"alice": "01", "bob": "10"}])
        assert _extract_register_names(result) == ["alice[0]", "alice[1]", "bob[0]", "bob[1]"]

    def test_numeric_tag_names_suppressed(self):
        """Digit-only tag names ('0', '1') → None (anonymous positional return)."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"0": "0", "1": "1"}])
        assert _extract_register_names(result) is None

    def test_numeric_array_tag_suppressed(self):
        """Digit-only array tag ('0' → '011') is also suppressed."""
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{"0": "011"}])
        assert _extract_register_names(result) is None

    def test_empty_results_returns_none(self):
        from app._compile_worker import _extract_register_names
        result = _FakeResult([])
        assert _extract_register_names(result) is None

    def test_empty_reg_bits_returns_none(self):
        from app._compile_worker import _extract_register_names
        result = _FakeResult([{}])
        assert _extract_register_names(result) is None

    def test_uses_first_shot_only(self):
        """Only the first shot is inspected for register names."""
        from app._compile_worker import _extract_register_names
        # Second shot has different keys — should be ignored
        result = _FakeResult([{"m0": "1"}, {"x": "0"}])
        assert _extract_register_names(result) == ["m0"]


# ── SimulationResults register_names field ─────────────────────────────────

class TestSimulationResultsRegisterNames:
    def test_register_names_absent_by_default(self):
        from app.models import SimulationResults
        r = SimulationResults(counts={"00": 512}, simulate_time_ms=10)
        assert r.register_names is None
        assert r.model_dump()["register_names"] is None

    def test_register_names_present_when_set(self):
        from app.models import SimulationResults
        r = SimulationResults(counts={"0": 512, "1": 512}, register_names=["m0"], simulate_time_ms=10)
        assert r.register_names == ["m0"]

    def test_register_names_serialises_correctly(self):
        from app.models import SimulationResults
        names = ["q[0]", "q[1]", "q[2]", "q[3]", "q[4]"]
        r = SimulationResults(
            counts={"00000": 512, "11111": 512},
            register_names=names,
            simulate_time_ms=20,
        )
        assert r.model_dump()["register_names"] == names

    def test_register_names_and_noisy_counts_coexist(self):
        from app.models import SimulationResults
        r = SimulationResults(
            counts={"00": 512, "11": 512},
            noisy_counts={"00": 490, "11": 500, "01": 22},
            register_names=["m0", "m1"],
            simulate_time_ms=30,
        )
        assert r.register_names == ["m0", "m1"]
        assert r.noisy_counts is not None


# ── Compiler passes register_names through ─────────────────────────────────

@pytest.mark.asyncio
async def test_compiler_passes_register_names_through():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    import json as _json

    names = ["q[0]", "q[1]", "q[2]", "q[3]", "q[4]"]
    worker_ok = SubprocessResult(
        stdout=_json.dumps({
            "status": "ok",
            "counts": {"00000": 512, "11111": 512},
            "noisy_counts": None,
            "register_names": names,
            "hugr_nodes": [], "hugr_json": None, "warnings": [], "qubit_count": 5,
        }),
        stderr="", returncode=0, timed_out=False,
    )
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=worker_ok)):
        result = await compile_and_simulate("x", shots=1024, simulator="stabilizer")

    assert not isinstance(result, list)
    _, sim_ok = result
    assert sim_ok.register_names == names


@pytest.mark.asyncio
async def test_compiler_register_names_none_when_absent():
    from unittest.mock import AsyncMock, patch
    from app.sandbox import SubprocessResult
    from app.compiler import compile_and_simulate
    import json as _json

    worker_ok = SubprocessResult(
        stdout=_json.dumps({
            "status": "ok",
            "counts": {"00": 512, "11": 512},
            "noisy_counts": None,
            "hugr_nodes": [], "hugr_json": None, "warnings": [], "qubit_count": 2,
        }),
        stderr="", returncode=0, timed_out=False,
    )
    with patch("app.compiler.run_subprocess", new=AsyncMock(return_value=worker_ok)):
        result = await compile_and_simulate("x", shots=1024, simulator="stabilizer")

    assert not isinstance(result, list)
    _, sim_ok = result
    assert sim_ok.register_names is None
