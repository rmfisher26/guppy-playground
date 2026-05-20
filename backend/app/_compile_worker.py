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

import ast
import importlib.util
import io
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
    source: str         = payload["source"]
    filename: str       = payload.get("filename", "main.py")
    shots: int          = payload.get("shots", 1024)
    simulator: str      = payload.get("simulator", "stabilizer")
    seed: int | None    = payload.get("seed")
    noise_model: str | None = payload.get("noise_model")
    error_rate: float   = float(payload.get("error_rate", 0.001))

    # Extract emulator config written inline in the source (e.g. main.emulator(1).run())
    # and strip those calls before importing to avoid double-execution.
    compile_only: bool      = bool(payload.get("compile_only", False))

    source_config = _parse_emulator_config(source)
    import_source = _strip_emulator_calls(source) if source_config else source

    # importlib requires a real file path, and guppylang reads the source file
    # directly to build error spans — exec(source) would lose that information.
    tmpfile = tempfile.NamedTemporaryFile(
        suffix=".py", mode="w", delete=False, prefix="guppy_user_"
    )
    tmppath = tmpfile.name
    stdout_holder: list[str | None] = [None]  # populated by _run after exec_module
    try:
        tmpfile.write(import_source)
        tmpfile.close()
        _run(tmppath, source, shots, simulator, seed, noise_model, error_rate, source_config, compile_only, stdout_holder)
    except Exception as exc:
        errors = _parse_error(exc, source, traceback.format_exc(), filename)
        print(json.dumps({"status": "error", "errors": errors, "stdout": stdout_holder[0]}))
    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass


def _run(tmppath: str, source: str, shots: int, simulator: str, seed: int | None, noise_model: str | None = None, error_rate: float = 0.001, source_config: dict | None = None, compile_only: bool = False, stdout_holder: list | None = None) -> None:
    from guppylang.defs import GuppyFunctionDefinition

    # Code-level emulator config takes precedence over UI-supplied parameters.
    if source_config:
        simulator = source_config.get("simulator", simulator)
        shots     = source_config.get("shots",     shots)
        seed      = source_config.get("seed",      seed)

    spec = importlib.util.spec_from_file_location("_guppy_user", tmppath)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load {tmppath}")

    module = importlib.util.module_from_spec(spec)
    # Capture user print() output so it can be forwarded to the frontend without
    # corrupting the JSON response channel (stdout is parsed as JSON by the backend).
    _saved_stdout = sys.stdout
    _capture = io.StringIO()
    sys.stdout = _capture
    try:
        spec.loader.exec_module(module)  # type: ignore[union-attr]
    except SystemExit:
        pass  # user programs or guppylang internals may call sys.exit() at module level
    finally:
        sys.stdout = _saved_stdout
    user_stdout: str | None = _capture.getvalue() or None
    if stdout_holder is not None:
        stdout_holder[0] = user_stdout
    # GuppyError propagates out of exec_module — let it bubble to main()

    # Find main() entry point first, then any other @guppy fn
    guppy_fn = None
    guppy_fn_name: str | None = None
    for attr in ("main", *dir(module)):
        obj = getattr(module, attr, None)
        if isinstance(obj, GuppyFunctionDefinition):
            guppy_fn = obj
            guppy_fn_name = attr
            break

    if guppy_fn is None:
        print(json.dumps({
            "status":      "ok",
            "counts":      {},
            "hugr_nodes":  _infer_nodes(source),
            "warnings":    [],
            "qubit_count": 0,
            "stdout":      user_stdout,
        }))
        return

    # Functions with qubit input parameters can't be run by the emulator without
    # a wrapper main(). Auto-switch to compile-only so type-check programs work.
    if not compile_only and guppy_fn_name != "main" and _has_qubit_params(source, guppy_fn_name or ""):
        compile_only = True

    n_qubits = (source_config.get("n_qubits") if source_config else None) or _infer_qubit_count(source)

    if simulator == "statevector" and n_qubits > MAX_QUBITS_STATEVECTOR:
        raise ValueError(
            f"Statevector needs 2^n memory: {n_qubits} qubits ≈ "
            f"{2**n_qubits * 16 // (1024**2)}MB. "
            f"Max is {MAX_QUBITS_STATEVECTOR}. Use Stabilizer instead."
        )
    if n_qubits > MAX_QUBITS_STABILIZER:
        raise ValueError(f"{n_qubits} qubits exceeds playground limit of {MAX_QUBITS_STABILIZER}.")

    # Compile HUGR for display panel.
    # compile() requires the entry point to be named 'main'; for any other
    # function (e.g. a subroutine with qubit params) fall back to regex-inferred
    # nodes rather than letting guppylang raise "Module entrypoint must have a
    # single function named main".
    hugr_nodes: list[dict] = []
    hugr_json: dict | None = None
    if guppy_fn_name == "main":
        try:
            pkg = guppy_fn.compile()
            hugr_str = pkg.to_str()
            try:
                json_start = hugr_str.index('{')
                hugr_json = json.loads(hugr_str[json_start:])
            except (ValueError, json.JSONDecodeError):
                pass
            hugr_nodes = _extract_nodes(hugr_str)
        except Exception:
            hugr_nodes = _infer_nodes(source)
    else:
        hugr_nodes = _infer_nodes(source)

    if compile_only:
        print(json.dumps({
            "status":          "ok",
            "counts":          {},
            "noisy_counts":    None,
            "register_names":  None,
            "hugr_nodes":      hugr_nodes,
            "hugr_json":       hugr_json,
            "warnings":        [],
            "qubit_count":     n_qubits,
            "state_snapshots": None,
            "stdout":          user_stdout,
        }))
        return

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

    counts          = _flatten_counts(result)
    register_names  = _extract_register_names(result)

    # Noisy simulation — only supported on stabilizer backend
    noisy_counts: dict[str, int] | None = None
    if noise_model == "depolarizing":
        try:
            from selene_sim import DepolarizingErrorModel
            p = max(0.0, min(1.0, error_rate))
            error_model_obj = DepolarizingErrorModel(p_1q=p, p_2q=p, p_meas=p, p_init=p)
            noisy_em = (
                guppy_fn.emulator(n_qubits=n_qubits)
                .with_shots(shots)
                .with_error_model(error_model_obj)
                .stabilizer_sim()
            )
            if seed is not None:
                noisy_em = noisy_em.with_seed(seed)
            noisy_result = noisy_em.run()
            noisy_counts = _flatten_counts(noisy_result)
        except Exception:
            pass  # if noisy sim fails, return ideal counts only

    # State snapshots — extract state_result() calls if present in source
    state_snapshots: list[list[dict]] | None = None
    if re.search(r'\bstate_result\s*\(', source):
        try:
            if simulator == "statevector":
                # Already have a statevector result — extract directly
                state_snapshots = _extract_state_snapshots(result)
            elif n_qubits <= MAX_QUBITS_STATEVECTOR:
                # Stabilizer was used for counts; run 1-shot statevector pass for states
                sv_em = (
                    guppy_fn.emulator(n_qubits=n_qubits)
                    .with_shots(1)
                    .statevector_sim()
                )
                if seed is not None:
                    sv_em = sv_em.with_seed(seed)
                state_snapshots = _extract_state_snapshots(sv_em.run())
        except Exception:
            pass

    print(json.dumps({
        "status":          "ok",
        "counts":          counts,
        "noisy_counts":    noisy_counts,
        "register_names":  register_names,
        "hugr_nodes":      hugr_nodes,
        "hugr_json":       hugr_json,
        "warnings":        [],
        "qubit_count":     n_qubits,
        "state_snapshots": state_snapshots,
        "stdout":          user_stdout,
    }))


# ── Result helpers ────────────────────────────────────────────────────────

def _flatten_counts(result) -> dict[str, int]:
    """Flatten shot register entries into bitstring → count mapping."""
    counts: dict[str, int] = {}
    for shot in result.results:
        parts = []
        for _, v in shot.entries:
            if isinstance(v, str):
                continue  # state_result() stores artifact file paths — skip them
            if isinstance(v, list):
                parts.append("".join(str(int(b)) for b in v))
            else:
                parts.append(str(int(v)))
        key = "".join(parts)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _extract_register_names(result) -> list[str] | None:
    """Return per-bit register names from the first shot, or None for anonymous returns.

    Uses QsysShot.to_register_bits() which handles scalar booleans, boolean arrays,
    and the reg[n] indexed tag convention.  Multi-bit registers are expanded:
      {"q": "011"} → ["q[0]", "q[1]", "q[2]"]
    Purely numeric tag names (anonymous tuple returns) are suppressed so callers
    receive None rather than uninformative labels like ["0", "1"].
    """
    if not result.results:
        return None
    try:
        reg_bits = result.results[0].to_register_bits()
    except Exception:
        return None  # state_result() artifact paths confuse to_register_bits()
    if not reg_bits:
        return None
    names: list[str] = []
    for reg, bits in reg_bits.items():
        if len(bits) == 1:
            names.append(reg)
        else:
            names.extend(f"{reg}[{i}]" for i in range(len(bits)))
    # Positional / anonymous returns use digit-only tag names — suppress them
    if all(re.fullmatch(r"\d+", n.split("[")[0]) for n in names):
        return None
    return names or None


def _extract_state_snapshots(result) -> list[list[dict]] | None:
    """Serialize state_result() snapshots from shot 0 into JSON-safe dicts.

    Returns [[{tag, num_qubits, specified_qubits, distribution}, ...]] (one outer
    list per captured shot, currently always length 1) or None if no snapshots.
    """
    try:
        partial_states = result.partial_states()   # list[list[tuple[str, PartialVector]]]
        if not partial_states:
            return None
        all_shots: list[list[dict]] = []
        for shot_states in partial_states[:1]:     # only shot 0 for display
            shot_snaps: list[dict] = []
            for tag, pv in shot_states:
                n_specified = len(pv.specified_qubits)
                if n_specified > 8:                # 2^8 = 256 amplitudes max
                    continue
                try:
                    distribution = [
                        {
                            "probability": float(ts.probability),
                            "amplitudes":  [[float(c.real), float(c.imag)] for c in ts.state],
                        }
                        for ts in pv.state_distribution()
                    ]
                    shot_snaps.append({
                        "tag":              tag,
                        "num_qubits":       pv.total_qubits,
                        "specified_qubits": list(pv.specified_qubits),
                        "distribution":     distribution,
                    })
                except Exception:
                    pass
            all_shots.append(shot_snaps)
        return all_shots if any(s for s in all_shots) else None
    except Exception:
        return None


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
    # Count array(qubit() for _ in range(n)) comprehensions specifically,
    # then count remaining bare qubit() calls outside those patterns.
    # Also count qubit-typed function parameters (e.g. src: qubit @ owned).
    # Falls back to 2 so the emulator always gets a valid circuit width.
    array_pat = r'array\s*\(\s*qubit\s*\(\s*\)\s+for\s+\w+\s+in\s+range\s*\(\s*(\d+)\s*\)\s*\)'
    array_total = sum(int(m) for m in re.findall(array_pat, source))
    stripped = re.sub(array_pat, '', source)
    individual = len(re.findall(r'\bqubit\(\)', stripped))
    param_qubits = len(re.findall(r':\s*qubit\b', source))
    return max(individual + array_total + param_qubits, 2)


def _has_qubit_params(source: str, fn_name: str) -> bool:
    """Return True if the named @guppy function has any qubit-typed parameters."""
    if not fn_name:
        return False
    try:
        tree = ast.parse(source)
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == fn_name:
                for arg in node.args.args:
                    if arg.annotation and "qubit" in ast.unparse(arg.annotation):
                        return True
    except (SyntaxError, AttributeError):
        pass
    return False


# ── Inline emulator config parsing ────────────────────────────────────────

def _parse_emulator_config(source: str) -> dict | None:
    """Extract emulator run parameters from module-level emulator chain calls.

    Detects patterns like:
        fn.emulator(n_qubits=1).run()
        fn.emulator(1).statevector_sim().with_shots(100).with_seed(42).run()

    Returns a dict with any subset of: n_qubits, simulator, shots, seed.
    Returns None if no such call is found or n_qubits cannot be determined.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None
    for node in tree.body:
        # Only inspect plain statements and assignments, not function/class defs.
        if not isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr)):
            continue
        config = _extract_emulator_chain_config(node)
        if config is not None:
            return config
    return None


def _extract_emulator_chain_config(node) -> dict | None:
    """Walk an AST statement to find a .emulator(...).....run() method chain.

    Walks the chain from .run() inward, collecting method names and arguments,
    until it reaches .emulator() and extracts n_qubits.
    """
    for child in ast.walk(node):
        if not (isinstance(child, ast.Call)
                and isinstance(child.func, ast.Attribute)
                and child.func.attr == "run"):
            continue
        config: dict = {}
        current = child.func.value
        while isinstance(current, ast.Call) and isinstance(current.func, ast.Attribute):
            method = current.func.attr
            if method == "emulator":
                if current.args:
                    try:
                        config["n_qubits"] = int(ast.literal_eval(current.args[0]))
                    except (ValueError, TypeError):
                        pass
                for kw in current.keywords:
                    if kw.arg == "n_qubits":
                        try:
                            config["n_qubits"] = int(ast.literal_eval(kw.value))
                        except (ValueError, TypeError):
                            pass
                return config if "n_qubits" in config else None
            elif method == "statevector_sim":
                config["simulator"] = "statevector"
            elif method == "stabilizer_sim":
                config["simulator"] = "stabilizer"
            elif method == "with_shots" and current.args:
                try:
                    config["shots"] = int(ast.literal_eval(current.args[0]))
                except (ValueError, TypeError):
                    pass
            elif method == "with_seed" and current.args:
                try:
                    config["seed"] = int(ast.literal_eval(current.args[0]))
                except (ValueError, TypeError):
                    pass
            current = current.func.value
    return None


def _strip_emulator_calls(source: str) -> str:
    """Remove module-level .emulator(...).run() statements from source.

    Prevents double-execution when the worker separately controls the emulator run.
    Only removes plain statement / assignment nodes — never function definitions.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    lines_to_remove: set[int] = set()
    for node in tree.body:
        if not isinstance(node, (ast.Assign, ast.AugAssign, ast.AnnAssign, ast.Expr)):
            continue
        if _node_has_emulator_run(node):
            end = getattr(node, "end_lineno", node.lineno)
            for ln in range(node.lineno, end + 1):
                lines_to_remove.add(ln)
    if not lines_to_remove:
        return source
    return "".join(
        line for i, line in enumerate(source.splitlines(keepends=True), start=1)
        if i not in lines_to_remove
    )


def _node_has_emulator_run(node) -> bool:
    """Return True if the AST node contains a .emulator(...).run() chain."""
    for child in ast.walk(node):
        if not (isinstance(child, ast.Call)
                and isinstance(child.func, ast.Attribute)
                and child.func.attr == "run"):
            continue
        current = child.func.value
        while isinstance(current, ast.Call) and isinstance(current.func, ast.Attribute):
            if current.func.attr == "emulator":
                return True
            current = current.func.value
    return False


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
