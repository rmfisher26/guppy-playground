"""
Sandboxed worker — compile AND simulate in one subprocess.

Reads JSON from stdin:
  { "source": "...", "shots": 1024, "simulator": "stabilizer"|"statevector",
    "seed": int|null }

Writes JSON to stdout:
  { "status": "ok", "counts": {...}, "hugr_nodes": [...], "warnings": [] }
  { "status": "error", "errors": [...] }

This is the ONLY file that imports guppylang and selene_sim.
The compile+simulate in one process avoids the selene daemon connection
issue that occurs when build() is called from a fresh subprocess.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import tempfile
import traceback

MAX_QUBITS_STATEVECTOR = 20   # 2^20 * 16B = 16MB — safe in container
MAX_QUBITS_STABILIZER  = 50


def main() -> None:
    payload    = json.loads(sys.stdin.read())
    source: str       = payload["source"]
    shots: int        = payload.get("shots", 1024)
    simulator: str    = payload.get("simulator", "stabilizer")
    seed: int | None  = payload.get("seed")

    tmpfile = tempfile.NamedTemporaryFile(
        suffix=".py", mode="w", delete=False, prefix="guppy_user_"
    )
    tmppath = tmpfile.name
    try:
        tmpfile.write(source)
        tmpfile.close()
        _run(tmppath, shots, simulator, seed)
    except Exception as exc:
        tb_str = traceback.format_exc()
        errors = _parse_errors(exc, tb_str)
        print(json.dumps({"status": "error", "errors": errors}))
    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass


def _run(tmppath: str, shots: int, simulator: str, seed: int | None) -> None:
    from guppylang.defs import GuppyFunctionDefinition

    spec = importlib.util.spec_from_file_location("_guppy_user", tmppath)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {tmppath}")

    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except SystemExit:
        pass

    # Prefer a function named 'main' as the emulator entry point.
    # The guppylang emulator requires an entry function that takes no arguments.
    # If the user hasn't written main(), fall back to the first @guppy function.
    guppy_fn = None
    for attr in ("main", *dir(module)):
        obj = getattr(module, attr, None)
        if isinstance(obj, GuppyFunctionDefinition):
            guppy_fn = obj
            break

    if guppy_fn is None:
        # No @guppy function found — check() was called, no simulation needed
        print(json.dumps({
            "status":     "ok",
            "counts":     {},
            "hugr_nodes": _infer_nodes(open(tmppath).read() if os.path.exists(tmppath) else ""),
            "warnings":   [],
            "qubit_count": 0,
        }))
        return

    # ── Qubit count ──────────────────────────────────────────────────────
    n_qubits = _infer_qubit_count_from_source(
        open(tmppath).read() if os.path.exists(tmppath) else ""
    )

    # ── Guard ────────────────────────────────────────────────────────────
    if simulator == "statevector" and n_qubits > MAX_QUBITS_STATEVECTOR:
        raise ValueError(
            f"Statevector needs 2^n memory: {n_qubits} qubits ≈ "
            f"{2**n_qubits * 16 // (1024**2)}MB. "
            f"Max is {MAX_QUBITS_STATEVECTOR}. Use Stabilizer instead."
        )
    if n_qubits > MAX_QUBITS_STABILIZER:
        raise ValueError(f"{n_qubits} qubits exceeds playground limit of {MAX_QUBITS_STABILIZER}.")

    # ── Compile HUGR nodes for display ───────────────────────────────────
    hugr_nodes: list[dict] = []
    warnings: list[dict]   = []
    try:
        pkg = guppy_fn.compile()
        hugr_str = pkg.to_str()
        hugr_nodes = _extract_nodes(hugr_str)
    except Exception:
        hugr_nodes = _infer_nodes(open(tmppath).read() if os.path.exists(tmppath) else "")

    # ── Simulate via guppylang emulator API ──────────────────────────────
    emulator = guppy_fn.emulator(n_qubits=n_qubits).with_shots(shots)
    if seed is not None:
        emulator = emulator.with_seed(seed)

    if simulator == "statevector":
        emulator = emulator.statevector_sim()
    else:
        emulator = emulator.stabilizer_sim()

    try:
        result = emulator.run()
    except Exception as exc:
        msg = str(exc)
        # Non-Clifford gates (T, Toffoli, Rz) can't run on stabilizer simulator.
        # Automatically retry with statevector if stabilizer fails with this error.
        if simulator == "stabilizer" and (
            "not representable in stabiliser form" in msg
            or "RXY" in msg
            or "Clifford" in msg
        ):
            emulator_sv = guppy_fn.emulator(n_qubits=n_qubits).with_shots(shots)
            if seed is not None:
                emulator_sv = emulator_sv.with_seed(seed)
            result = emulator_sv.statevector_sim().run()
        else:
            raise

    # Aggregate shot entries into bitstring counts
    counts: dict[str, int] = {}
    for shot in result.results:
        parts = []
        for _, v in shot.entries:
            if isinstance(v, list):
                parts.append("".join(str(int(b)) for b in v))
            else:
                parts.append(str(int(v)))
        key = "".join(parts)
        counts[key] = counts.get(key, 0) + 1

    print(json.dumps({
        "status":      "ok",
        "counts":      counts,
        "hugr_nodes":  hugr_nodes,
        "warnings":    warnings,
        "qubit_count": n_qubits,
    }))


def _infer_qubit_count_from_source(source: str) -> int:
    """Count qubit() calls + array sizes to estimate circuit width."""
    # Count explicit qubit() calls
    individual = len(re.findall(r'\bqubit\(\)', source))
    # Count array(qubit() for _ in range(N)) patterns
    array_total = sum(int(m) for m in re.findall(r'range\((\d+)\)', source))
    total = individual + array_total
    return max(total, 2)


def _extract_nodes(hugr_str: str) -> list[dict]:
    """Extract display nodes from HUGR envelope string."""
    try:
        json_start = hugr_str.index('{')
        data = json.loads(hugr_str[json_start:])
    except (ValueError, json.JSONDecodeError):
        return []

    nodes: list[dict] = []
    nid = [0]
    type_map = {
        "DFG": "DFG", "FuncDefn": "FuncDef", "FuncDecl": "FuncDef",
        "Call": "Call", "H": "Gate", "CX": "Gate", "CZ": "Gate",
        "X": "Gate", "Y": "Gate", "Z": "Gate", "S": "Gate", "T": "Gate",
        "Rz": "Gate", "Rx": "Gate", "Ry": "Gate", "Toffoli": "Gate",
        "Measure": "Measure", "QAlloc": "Gate", "QFree": "Gate",
        "Const": "Const", "Input": "Input", "Output": "Output",
    }

    def walk(obj: dict, depth: int) -> None:
        op   = obj.get("op", obj.get("type", "Unknown"))
        name = obj.get("name", op)
        nodes.append({
            "id": str(nid[0]), "type": type_map.get(op, "Call"),
            "name": name, "meta": "", "parent": None, "depth": depth,
        })
        nid[0] += 1
        for child in obj.get("children", []):
            if isinstance(child, dict):
                walk(child, depth + 1)

    for n in data.get("modules", [{}])[0].get("nodes", []):
        if isinstance(n, dict):
            walk(n, 0)
    return nodes


def _infer_nodes(source: str) -> list[dict]:
    """Fallback: approximate nodes from source analysis."""
    nodes: list[dict] = []
    nid = [0]

    def add(type_: str, name: str, depth: int) -> None:
        nodes.append({"id": str(nid[0]), "type": type_, "name": name,
                       "meta": "", "depth": depth, "parent": None})
        nid[0] += 1

    gate_ops    = {"h","cx","cz","x","y","z","s","t","toffoli","rx","ry","rz"}
    measure_ops = {"measure","measure_array"}

    add("DFG", "module", 0)
    fn_pat = re.compile(r"@guppy(?:\.[^\n]*)?\ndef\s+(\w+)\s*\(([^)]*)\)\s*->\s*([^:]+):", re.MULTILINE)

    for m in fn_pat.finditer(source):
        add("FuncDef", f"{m.group(1)}({m.group(2).strip()}) → {m.group(3).strip()}", 1)
        start   = m.end()
        next_fn = fn_pat.search(source, start)
        body    = source[start: next_fn.start() if next_fn else len(source)]
        seen: set[str] = set()
        for call in re.finditer(r"\b(\w+)\s*\(", body):
            op = call.group(1).lower()
            if op in gate_ops and op not in seen:
                add("Gate", op.upper(), 2); seen.add(op)
            elif op in measure_ops and op not in seen:
                add("Measure", op, 2); seen.add(op)
    return nodes


def _parse_errors(exc: Exception, tb_str: str) -> list[dict]:
    msg      = str(exc)
    combined = msg + "\n" + tb_str

    line = 1
    for pat in [r"line (\d+)", r":(\d+):"]:
        m = re.search(pat, combined)
        if m:
            line = int(m.group(1))
            break

    msg_lower = msg.lower()
    if any(k in msg_lower for k in ("linear","qubit","owned","borrow","drop","already")):
        kind = "linearity_error"
    elif any(k in msg_lower for k in ("type","expected","got","annotation")):
        kind = "type_error"
    elif any(k in msg_lower for k in ("syntax","invalid syntax")):
        kind = "syntax_error"
    elif any(k in msg_lower for k in ("name","not defined","undefined")):
        kind = "name_error"
    else:
        kind = "internal_error"

    display = _clean_message(msg)
    return [{"message": display[:300], "line": line, "col": 0, "kind": kind}]


def _clean_message(msg: str) -> str:
    if "AlreadyUsed" in msg:
        m = re.search(r"place=Variable\(name='(\w+)'", msg)
        return f"Linearity error: '{m.group(1) if m else 'qubit'}' already used or consumed"
    if "NotUsed" in msg or "DropError" in msg or "leaked" in msg.lower():
        m = re.search(r"Variable `(\w+)`", msg) or re.search(r"place=Variable\(name='(\w+)'", msg)
        return f"Linearity error: '{m.group(1) if m else 'qubit'}' was never measured or discarded"
    first = next((l.strip() for l in msg.splitlines() if l.strip()), msg)
    first = re.sub(r"guppy_user_\w+\.py", "your_program.py", first)
    return first


if __name__ == "__main__":
    main()
