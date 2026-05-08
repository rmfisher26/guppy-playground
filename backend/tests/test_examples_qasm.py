"""
Integration tests: compile every example and validate its QASM output.

Tests run the compile worker as a subprocess (matching production) and verify:
  - every example compiles without error
  - examples with a linear top-level gate sequence produce non-None QASM
  - examples that use array qubits or top-level for-loops produce None QASM
    (those HUGR constructs are not yet handled by the QASM extractor)
  - every non-None QASM is valid OpenQASM 2.0 (correct header, parseable by pytket)
  - qubit register size in the QASM is positive and consistent
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import pytest

WORKER = Path(__file__).parent.parent / "app" / "_compile_worker.py"


# ── Helpers ────────────────────────────────────────────────────────────────

def _run_worker(source: str, shots: int = 64, seed: int = 42) -> dict:
    payload = json.dumps({
        "source": source,
        "shots": shots,
        "simulator": "stabilizer",
        "seed": seed,
    })
    proc = subprocess.run(
        [sys.executable, str(WORKER)],
        input=payload,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.stdout.strip(), (
        f"Worker produced no output. stderr: {proc.stderr[:300]}"
    )
    return json.loads(proc.stdout)


def _check_qasm_structure(qasm: str) -> str | None:
    """Return None if the QASM has valid structure, or an error string if not."""
    if not qasm.startswith("OPENQASM 2.0;"):
        return "missing 'OPENQASM 2.0;' header"
    if 'include "qelib1.inc";' not in qasm:
        return "missing 'include \"qelib1.inc\";'"
    if not re.search(r"qreg \w+\[\d+\];", qasm):
        return "missing qreg declaration"
    return None


# ── Session-scoped fixture: compile every example once ────────────────────

@pytest.fixture(scope="session")
def all_results() -> dict[str, dict]:
    from app.examples_data import EXAMPLES
    return {ex.id: _run_worker(ex.source) for ex in EXAMPLES}


def _example_ids() -> list[str]:
    from app.examples_data import EXAMPLES
    return [ex.id for ex in EXAMPLES]


# ── QASM presence expectation per example ─────────────────────────────────
#
# True  = linear top-level body; extractor produces QASM (may be partial
#         if the example contains function calls — those appear as a Call
#         node in the top-level DataflowBlock, so only inline gates are
#         captured).
# False = array qubit allocation or for-loop at the top level; those HUGR
#         constructs don't create individual QAlloc nodes in the main block,
#         so the extractor returns None.

QASM_EXPECTED: dict[str, bool] = {
    "bell":     True,
    "teleport": True,
    "deutsch":  True,
    "ghz":      False,
    "qec":      True,
}


# ── Tests: compilation ─────────────────────────────────────────────────────

@pytest.mark.parametrize("eid", _example_ids())
def test_example_compiles_successfully(eid, all_results):
    """Every bundled example must compile without error."""
    data = all_results[eid]
    assert data["status"] == "ok", (
        f"Example '{eid}' failed to compile: "
        f"{data.get('errors') or data.get('error')}"
    )


# ── Tests: QASM presence ───────────────────────────────────────────────────

@pytest.mark.parametrize("eid", _example_ids())
def test_example_qasm_presence(eid, all_results):
    """QASM is non-None iff the example has a linear top-level qubit body."""
    data = all_results[eid]
    if data["status"] != "ok":
        pytest.skip(f"'{eid}' did not compile; skipping QASM presence check")

    expected = QASM_EXPECTED.get(eid)
    if expected is None:
        pytest.skip(f"No QASM expectation registered for new example '{eid}'")

    qasm = data.get("qasm")
    if expected:
        assert qasm is not None and qasm.strip(), (
            f"Example '{eid}' expected QASM but got None. "
            "Update QASM_EXPECTED if this example changed."
        )
    else:
        assert qasm is None, (
            f"Example '{eid}' expected no QASM (array/loop circuit) but got:\n{qasm}"
        )


# ── Tests: structure ────────────────────────────────────────────────────────

@pytest.mark.parametrize("eid", _example_ids())
def test_example_qasm_valid_header(eid, all_results):
    """Non-None QASM must start with the OpenQASM 2.0 header and qelib1 include."""
    qasm = all_results[eid].get("qasm")
    if not qasm:
        pytest.skip(f"'{eid}' produced no QASM (expected for array/loop circuits)")
    err = _check_qasm_structure(qasm)
    assert err is None, f"'{eid}' QASM invalid structure: {err}\n\n{qasm[:400]}"


@pytest.mark.parametrize("eid", _example_ids())
def test_example_qasm_qubit_register_positive(eid, all_results):
    """qreg must declare at least one qubit."""
    qasm = all_results[eid].get("qasm")
    if not qasm:
        pytest.skip(f"'{eid}' produced no QASM")
    m = re.search(r"qreg \w+\[(\d+)\];", qasm)
    assert m, f"'{eid}' QASM has no qreg declaration"
    assert int(m.group(1)) > 0, f"'{eid}' QASM qreg declares 0 qubits"


@pytest.mark.parametrize("eid", _example_ids())
def test_example_qasm_gate_lines_are_valid_syntax(eid, all_results):
    """Every non-comment, non-header line should look like a QASM statement."""
    qasm = all_results[eid].get("qasm")
    if not qasm:
        pytest.skip(f"'{eid}' produced no QASM")

    # Allowed line patterns
    header_re = re.compile(
        r"^(OPENQASM\s|include\s|qreg\s|creg\s|gate\s|"
        r"[a-z][a-z0-9_]*(\([^)]*\))?\s+q\[|\s*$|measure\s|//)"
    )
    for line in qasm.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        assert header_re.match(stripped), (
            f"'{eid}' QASM has unexpected line:\n  {stripped!r}"
        )


# ── Tests: pytket round-trip ───────────────────────────────────────────────

@pytest.mark.parametrize("eid", _example_ids())
def test_example_qasm_parseable_by_pytket(eid, all_results):
    """pytket must be able to load the QASM — the strongest validity check."""
    qasm = all_results[eid].get("qasm")
    if not qasm:
        pytest.skip(f"'{eid}' produced no QASM")
    try:
        from pytket.qasm import circuit_from_qasm_str
    except ImportError:
        pytest.skip("pytket not available in this environment")

    circ = circuit_from_qasm_str(qasm)
    assert circ.n_qubits > 0, (
        f"pytket loaded '{eid}' QASM but circuit has 0 qubits"
    )


# ── Tests: per-example golden assertions ──────────────────────────────────

def test_bell_qasm_is_complete(all_results):
    """Bell pair is fully linear; every gate should appear in the QASM."""
    qasm = all_results["bell"].get("qasm")
    assert qasm is not None, "Bell QASM must not be None"
    assert "h "       in qasm, "Bell QASM missing H gate"
    assert "cx "      in qasm, "Bell QASM missing CX gate"
    assert "measure " in qasm, "Bell QASM missing measurements"
    assert "creg "    in qasm, "Bell QASM missing classical register"


def test_qec_qasm_contains_encoding_and_syndrome(all_results):
    """QEC QASM must include the encoding CX gates and syndrome measurements."""
    qasm = all_results["qec"].get("qasm")
    assert qasm is not None, "QEC QASM must not be None"
    cx_count = qasm.count("cx ")
    assert cx_count >= 4, (
        f"QEC QASM has {cx_count} CX gates; expected >= 4 (2 encoding + 2 syndrome)"
    )
    assert "measure " in qasm, "QEC QASM must include syndrome measurements"


def test_deutsch_qasm_contains_state_prep_gates(all_results):
    """Deutsch main() prepares the initial state with H, X; those must appear."""
    qasm = all_results["deutsch"].get("qasm")
    assert qasm is not None, "Deutsch QASM must not be None"
    assert "h " in qasm, "Deutsch QASM missing H gate"
    assert "x " in qasm, "Deutsch QASM missing X gate"


def test_teleport_qasm_contains_initial_h(all_results):
    """Teleport main() applies H to src before the teleport call; must appear."""
    qasm = all_results["teleport"].get("qasm")
    assert qasm is not None, "Teleport QASM must not be None"
    assert "h " in qasm, "Teleport QASM missing H gate from state preparation"


def test_ghz_qasm_is_none(all_results):
    """GHZ uses array qubit allocation + for-loop; QASM extractor returns None."""
    assert all_results["ghz"].get("qasm") is None, (
        "GHZ QASM should be None — the array/loop HUGR construct is not yet "
        "handled. If this passes, update QASM_EXPECTED['ghz'] = True."
    )
