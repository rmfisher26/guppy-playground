"""Unit tests for inline emulator config parsing in _compile_worker."""
from __future__ import annotations
import sys
import os

# Make the worker importable without installing guppylang.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app._compile_worker import _parse_emulator_config, _strip_emulator_calls


# ── _parse_emulator_config ─────────────────────────────────────────────────

def test_minimal_positional():
    src = "res = main.emulator(1).run()"
    cfg = _parse_emulator_config(src)
    assert cfg is not None
    assert cfg["n_qubits"] == 1
    assert "simulator" not in cfg
    assert "shots" not in cfg
    assert "seed" not in cfg


def test_keyword_n_qubits():
    src = "main.emulator(n_qubits=3).run()"
    cfg = _parse_emulator_config(src)
    assert cfg is not None
    assert cfg["n_qubits"] == 3


def test_statevector_sim():
    src = "res = main.emulator(2).statevector_sim().run()"
    cfg = _parse_emulator_config(src)
    assert cfg["simulator"] == "statevector"


def test_stabilizer_sim():
    src = "res = main.emulator(2).stabilizer_sim().run()"
    cfg = _parse_emulator_config(src)
    assert cfg["simulator"] == "stabilizer"


def test_with_shots():
    src = "res = main.emulator(1).with_shots(100).run()"
    cfg = _parse_emulator_config(src)
    assert cfg["shots"] == 100


def test_with_seed():
    src = "res = main.emulator(1).with_seed(42).run()"
    cfg = _parse_emulator_config(src)
    assert cfg["seed"] == 42


def test_full_chain_single_line():
    src = "res = main.emulator(1).statevector_sim().with_shots(100).with_seed(42).run()"
    cfg = _parse_emulator_config(src)
    assert cfg == {"n_qubits": 1, "simulator": "statevector", "shots": 100, "seed": 42}


def test_full_chain_multiline():
    src = (
        "res = (main.emulator(1)\n"
        "    .statevector_sim()\n"
        "    .with_shots(100)\n"
        "    .with_seed(42)\n"
        "    .run())\n"
    )
    cfg = _parse_emulator_config(src)
    assert cfg == {"n_qubits": 1, "simulator": "statevector", "shots": 100, "seed": 42}


def test_no_emulator_call_returns_none():
    src = "x = 1 + 2"
    assert _parse_emulator_config(src) is None


def test_check_call_not_confused_with_run():
    src = "main.check()"
    assert _parse_emulator_config(src) is None


def test_emulator_inside_function_def_ignored():
    src = (
        "def helper():\n"
        "    return main.emulator(1).run()\n"
    )
    assert _parse_emulator_config(src) is None


def test_syntax_error_returns_none():
    src = "this is @@@ not valid python"
    assert _parse_emulator_config(src) is None


def test_emulator_without_n_qubits_returns_none():
    # If n_qubits cannot be determined, we return None.
    src = "main.emulator().run()"
    assert _parse_emulator_config(src) is None


# ── _strip_emulator_calls ──────────────────────────────────────────────────

def test_strip_single_line_assignment():
    src = "x = 1\nres = main.emulator(1).run()\ny = 2\n"
    stripped = _strip_emulator_calls(src)
    assert "emulator" not in stripped
    assert "x = 1" in stripped
    assert "y = 2" in stripped


def test_strip_bare_expression():
    src = "main.emulator(1).run()\n"
    stripped = _strip_emulator_calls(src)
    assert "emulator" not in stripped


def test_strip_multiline_chain():
    src = (
        "before = 1\n"
        "res = (main.emulator(1)\n"
        "    .statevector_sim()\n"
        "    .with_shots(100)\n"
        "    .run())\n"
        "after = 2\n"
    )
    stripped = _strip_emulator_calls(src)
    assert "emulator" not in stripped
    assert "before = 1" in stripped
    assert "after = 2" in stripped


def test_strip_does_not_remove_function_def():
    src = (
        "def helper():\n"
        "    return main.emulator(1).run()\n"
    )
    stripped = _strip_emulator_calls(src)
    # The function definition must be preserved.
    assert "def helper" in stripped


def test_strip_no_emulator_unchanged():
    src = "x = 1\ny = 2\n"
    assert _strip_emulator_calls(src) == src


def test_strip_syntax_error_returns_original():
    src = "this is @@@ not valid"
    assert _strip_emulator_calls(src) == src
