"""
Sandboxed worker — compile AND simulate in one subprocess.

Reads JSON from stdin:
  { "source": "...", "shots": 1024, "simulator": "stabilizer"|"statevector",
    "seed": int|null }

Writes JSON to stdout:
  { "status": "ok",    "counts": {...}, "hugr_nodes": [...], "warnings": [] }
  { "status": "error", "errors": [{
      "message": "Error: Index out of bounds...(pretty-printed)",
      "raw_message": "...",
      "line": 8, "col": 1, "kind": "type_error"
  }] }

This is the ONLY file that imports guppylang and selene_sim directly.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import tempfile
import traceback

MAX_QUBITS_STATEVECTOR = 20
MAX_QUBITS_STABILIZER  = 50


def main() -> None:
    payload    = json.loads(sys.stdin.read())
    source: str       = payload["source"]
    filename: str     = payload.get("filename", "main.py")
    shots: int        = payload.get("shots", 1024)
    simulator: str    = payload.get("simulator", "stabilizer")
    seed: int | None  = payload.get("seed")

    # importlib requires a real file path, and guppylang reads the source file
    # directly to build error spans — exec(source) would lose that information.
    tmpfile = tempfile.NamedTemporaryFile(
        suffix=".py", mode="w", delete=False, prefix="guppy_user_"
    )
    tmppath = tmpfile.name
    try:
        tmpfile.write(source)
        tmpfile.close()
        _run(tmppath, source, shots, simulator, seed)
    except Exception as exc:
        errors = _parse_error(exc, source, traceback.format_exc(), filename)
        print(json.dumps({"status": "error", "errors": errors}))
    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass


def _run(tmppath: str, source: str, shots: int, simulator: str, seed: int | None) -> None:
    from guppylang.defs import GuppyFunctionDefinition

    spec = importlib.util.spec_from_file_location("_guppy_user", tmppath)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {tmppath}")

    module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except SystemExit:
        pass  # user programs or guppylang internals may call sys.exit() at module level
    # GuppyError propagates out of exec_module — let it bubble to main()

    # Find main() entry point first, then any other @guppy fn
    guppy_fn = None
    for attr in ("main", *dir(module)):
        obj = getattr(module, attr, None)
        if isinstance(obj, GuppyFunctionDefinition):
            guppy_fn = obj
            break

    if guppy_fn is None:
        print(json.dumps({
            "status":      "ok",
            "counts":      {},
            "hugr_nodes":  _infer_nodes(source),
            "warnings":    [],
            "qubit_count": 0,
        }))
        return

    n_qubits = _infer_qubit_count(source)

    if simulator == "statevector" and n_qubits > MAX_QUBITS_STATEVECTOR:
        raise ValueError(
            f"Statevector needs 2^n memory: {n_qubits} qubits ≈ "
            f"{2**n_qubits * 16 // (1024**2)}MB. "
            f"Max is {MAX_QUBITS_STATEVECTOR}. Use Stabilizer instead."
        )
    if n_qubits > MAX_QUBITS_STABILIZER:
        raise ValueError(f"{n_qubits} qubits exceeds playground limit of {MAX_QUBITS_STABILIZER}.")

    # Compile HUGR for display panel
    hugr_nodes: list[dict] = []
    hugr_json: dict | None = None
    tket_mermaid: str | None = None
    try:
        pkg = guppy_fn.compile()
        hugr_str = pkg.to_str()
        try:
            json_start = hugr_str.index('{')
            hugr_json = json.loads(hugr_str[json_start:])
        except (ValueError, json.JSONDecodeError):
            pass
        hugr_nodes = _extract_nodes(hugr_str)
        try:
            from tket.circuit import Tk2Circuit, render_circuit_mermaid
            tk2 = Tk2Circuit.from_str(hugr_str)
            tket_mermaid = render_circuit_mermaid(tk2)
        except Exception:
            pass
    except Exception:
        hugr_nodes = _infer_nodes(source)

    # Simulate
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
        if simulator == "stabilizer" and any(
            k in msg for k in ("not representable in stabiliser form", "RXY", "Clifford")
        ):
            # Non-Clifford gates (e.g. T, Rz) can't run on the stabilizer backend;
            # silently retry with statevector so the user still gets results.
            emulator_sv = guppy_fn.emulator(n_qubits=n_qubits).with_shots(shots)
            if seed is not None:
                emulator_sv = emulator_sv.with_seed(seed)
            result = emulator_sv.statevector_sim().run()
        else:
            raise

    # Flatten each shot's register entries into a single bit-string key.
    # Registers can be scalar booleans or boolean arrays (qubit arrays);
    # both are normalised to "0"/"1" characters and concatenated.
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
        "status":        "ok",
        "counts":        counts,
        "hugr_nodes":    hugr_nodes,
        "hugr_json":     hugr_json,
        "tket_mermaid":  tket_mermaid,
        "warnings":      [],
        "qubit_count":   n_qubits,
    }))


# ── Error rendering ────────────────────────────────────────────────────────

def _parse_error(exc: Exception, source: str, tb_str: str, filename: str = "main.py") -> list[dict]:
    """
    Convert any exception into a structured error dict.
    For GuppyError, renders the pretty source-annotated message that
    guppylang shows when run as a script.
    For other exceptions, falls back to cleaned plain-text formatting.
    """
    if hasattr(exc, "error"):
        return [_render_guppy_error(exc, source, filename)]
    return [_render_plain_error(exc, tb_str)]


def _render_guppy_error(exc: Exception, source: str, filename: str = "main.py") -> dict:
    """
    Build the canonical guppylang error display from a GuppyError's
    internal .error object, which carries structured span + message data.

    Output format:
        Error: <title> (at $FILE:<line>:<col>)
          |
        N | <context line>
        N | <error line>
          |   ^^ <label>

        Guppy compilation failed due to 1 previous error
    """
    try:
        err  = exc.error
        span = err.span

        title = getattr(err, "rendered_title", None) or getattr(err, "title", "Error")
        label = getattr(err, "rendered_span_label", None) or getattr(err, "span_label", "") or ""

        # span.lineno is relative to span.source (the function body).
        # Locate the function body inside the full source to get absolute line.
        func_source: str = getattr(span, "source", "") or ""
        abs_lineno = getattr(span, "lineno", 1)
        func_first_line = func_source.split("\n")[0].strip()
        full_lines = source.split("\n")
        func_start_line = 1
        if func_first_line:
            for i, ln in enumerate(full_lines):
                if func_first_line in ln:
                    func_start_line = i + 1
                    break
        absolute_line = func_start_line + abs_lineno - 1

        col     = getattr(span, "col_offset",     0)
        end_col = getattr(span, "end_col_offset", col + 1)

        # Build context lines (up to 2 lines before, the error line itself)
        ctx_start = max(1, absolute_line - 2)
        ctx_end   = min(len(full_lines), absolute_line)
        ctx_lines = [(ln, full_lines[ln - 1]) for ln in range(ctx_start, ctx_end + 1)]

        # Use the display filename passed from the frontend (e.g. "main.py",
        # "bell_pair.py") rather than the internal temp file path.
        w = len(str(ctx_end))  # width of the widest line number in context
        pad = " " * w
        out = [f"Error: {title} (at {filename}:{absolute_line}:{col})", f"{pad} | "]
        for ln, text in ctx_lines:
            out.append(f"{str(ln).rjust(w)} | {text}")
            if ln == absolute_line:
                caret = "^" * max(1, end_col - col)
                pointer = " " * col + caret
                if label:
                    pointer += " " + label
                out.append(f"{pad} | {pointer}")
        out += ["", "Guppy compilation failed due to 1 previous error"]

        pretty = "\n".join(out)

        # Classify kind
        title_lower = title.lower()
        if any(k in title_lower for k in ("linear", "qubit", "owned", "borrow", "drop",
                                           "already", "copy", "move")):
            kind = "linearity_error"
        elif any(k in title_lower for k in ("syntax", "invalid syntax")):
            kind = "syntax_error"
        elif any(k in title_lower for k in ("name", "undefined", "unresolved", "not defined")):
            kind = "name_error"
        else:
            kind = "type_error"

        return {
            "message":     pretty,
            "raw_message": str(exc),
            "line":        absolute_line,
            "col":         col,
            "kind":        kind,
        }

    except Exception:
        # If our renderer itself breaks, fall back to the exception repr
        return _render_plain_error(exc, "")


def _render_plain_error(exc: Exception, tb_str: str) -> dict:
    """Fallback for non-GuppyError exceptions (syntax errors, import errors, etc.)"""
    msg = str(exc)
    combined = msg + "\n" + tb_str

    line = 1
    for pat in [r"line (\d+)", r":(\d+):"]:
        m = re.search(pat, combined)
        if m:
            line = int(m.group(1))
            break

    msg_lower = msg.lower()
    if any(k in msg_lower for k in ("linear", "qubit", "owned", "already", "copy")):
        kind = "linearity_error"
    elif any(k in msg_lower for k in ("syntax", "invalid syntax")):
        kind = "syntax_error"
    elif any(k in msg_lower for k in ("name", "not defined", "undefined")):
        kind = "name_error"
    else:
        kind = "type_error"

    # Clean up internal paths and object reprs
    display = next((l.strip() for l in msg.splitlines() if l.strip()), msg)
    display = re.sub(r"/[^ ]+/guppy_user_\w+\.py", "your_program.py", display)
    display = re.sub(r"\(span=<[^>]+>,?\s*", "(", display)

    return {"message": display[:300], "line": line, "col": 0, "kind": kind}


# ── Qubit count heuristic ──────────────────────────────────────────────────

def _infer_qubit_count(source: str) -> int:
    # Heuristic: count bare qubit() calls and sum range(n) sizes for qubit arrays.
    # Falls back to 2 so the emulator always gets a valid circuit width.
    individual = len(re.findall(r'\bqubit\(\)', source))
    array_total = sum(int(m) for m in re.findall(r'range\((\d+)\)', source))
    return max(individual + array_total, 2)


# ── HUGR node extraction ───────────────────────────────────────────────────

def _extract_nodes(hugr_str: str) -> list[dict]:
    # hugr_str may contain a text preamble before the JSON object; skip to '{'.
    try:
        json_start = hugr_str.index('{')
        data = json.loads(hugr_str[json_start:])
    except (ValueError, json.JSONDecodeError):
        return []
    nodes: list[dict] = []
    nid = [0]  # list so the nested walk() closure can mutate it
    type_map = {
        "DFG": "DFG", "FuncDefn": "FuncDef", "FuncDecl": "FuncDef",
        "Call": "Call", "H": "Gate", "CX": "Gate", "CZ": "Gate",
        "X": "Gate", "Y": "Gate", "Z": "Gate", "S": "Gate", "T": "Gate",
        "Rz": "Gate", "Rx": "Gate", "Ry": "Gate", "Toffoli": "Gate",
        "Measure": "Measure", "QAlloc": "Gate", "QFree": "Gate",
        "Const": "Const", "Input": "Input", "Output": "Output",
    }
    def walk(obj: dict, depth: int) -> None:
        op = obj.get("op", obj.get("type", "Unknown"))
        nodes.append({
            "id": str(nid[0]), "type": type_map.get(op, "Call"),
            "name": obj.get("name", op), "meta": "", "parent": None, "depth": depth,
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
    # Static fallback used when HUGR compilation fails — parses @guppy decorators
    # and gate call sites with regex to produce a best-effort node tree.
    nodes: list[dict] = []
    nid = [0]  # list so the nested add() closure can mutate it
    def add(type_: str, name: str, depth: int) -> None:
        nodes.append({"id": str(nid[0]), "type": type_, "name": name,
                       "meta": "", "depth": depth, "parent": None})
        nid[0] += 1
    gate_ops    = {"h","cx","cz","x","y","z","s","t","toffoli","rx","ry","rz"}
    measure_ops = {"measure","measure_array"}
    add("DFG", "module", 0)
    fn_pat = re.compile(
        r"@guppy(?:\.[^\n]*)?\ndef\s+(\w+)\s*\(([^)]*)\)\s*->\s*([^:]+):",
        re.MULTILINE,
    )
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


if __name__ == "__main__":
    main()
