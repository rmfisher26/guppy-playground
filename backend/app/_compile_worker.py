"""
Sandboxed compile worker — runs as a subprocess.

Reads JSON from stdin:
  { "source": "...", "entry_point": "..." | null }

Writes JSON to stdout:
  { "status": "ok",    "hugr_json": "...(JSON string)...",
    "hugr_nodes": [...], "warnings": [] }
  { "status": "error", "errors": [...] }

This is the ONLY file that imports guppylang directly.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import sys
import tempfile
import traceback


# ── Error parsing ──────────────────────────────────────────────────────────

def parse_guppy_errors(exc: Exception, tb_str: str) -> list[dict]:
    """Extract structured error info from a guppylang exception."""
    msg = str(exc)
    combined = msg + "\n" + tb_str

    # Try to find a line number
    line = 1
    for pattern in [r"line (\d+)", r":(\d+):"]:
        m = re.search(pattern, combined)
        if m:
            line = int(m.group(1))
            break

    # Classify error kind from message content
    msg_lower = msg.lower()
    if any(k in msg_lower for k in ("linear", "qubit", "owned", "borrow", "drop", "no-cloning")):
        kind = "linearity_error"
    elif any(k in msg_lower for k in ("type", "expected", "got", "annotation", "argument")):
        kind = "type_error"
    elif any(k in msg_lower for k in ("syntax", "invalid syntax", "unexpected token")):
        kind = "syntax_error"
    elif any(k in msg_lower for k in ("name", "not defined", "undefined", "unresolved")):
        kind = "name_error"
    else:
        kind = "internal_error"

    # Clean up the message — strip internal class names and truncate
    # e.g. "AlreadyUsedError(...)" → "Qubit 'q' used after it was already consumed"
    clean = _clean_error_message(msg)

    return [{"message": clean[:300], "line": line, "col": 0, "kind": kind}]


def _clean_error_message(msg: str) -> str:
    """Produce a developer-friendly error string from guppylang internals."""
    # Already-used qubit errors
    if "AlreadyUsed" in msg:
        m = re.search(r"place=Variable\(name='(\w+)'", msg)
        var = m.group(1) if m else "qubit"
        return f"Linearity error: '{var}' has already been used or consumed"

    # Not-used qubit errors  
    if "NotUsed" in msg or "DropError" in msg:
        m = re.search(r"place=Variable\(name='(\w+)'", msg)
        var = m.group(1) if m else "qubit"
        return f"Linearity error: '{var}' was never measured or discarded"

    # Type errors — strip internal repr noise
    if "TypeError" in msg or "type" in msg.lower():
        first_line = msg.split("\n")[0].strip()
        return re.sub(r"<[^>]+>", "", first_line).strip()

    # Default: return first non-empty line, cleaned of internal paths
    first = next((l.strip() for l in msg.splitlines() if l.strip()), msg)
    # Strip temp file names like "guppy_user_abc123.py"
    first = re.sub(r"guppy_user_\w+\.py", "your_program.py", first)
    return first


# ── HUGR node extraction ───────────────────────────────────────────────────

def extract_hugr_nodes(hugr_json: dict) -> list[dict]:
    """
    Walk a HUGR JSON object and produce a flat list of display nodes.
    HUGR's exact schema evolves — this is best-effort for the UI.
    """
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
        meta = ""

        if "signature" in obj:
            sig = obj["signature"]
            ins  = sig.get("input",  {}).get("types", [])
            outs = sig.get("output", {}).get("types", [])
            if ins or outs:
                meta = f"{ins} → {outs}"

        nodes.append({
            "id":     str(nid[0]),
            "type":   type_map.get(op, "Call"),
            "name":   name,
            "meta":   meta,
            "parent": None,
            "depth":  depth,
        })
        nid[0] += 1

        for child in obj.get("children", []):
            if isinstance(child, dict):
                walk(child, depth + 1)

    for n in hugr_json.get("nodes", []):
        if isinstance(n, dict):
            walk(n, 0)
    if not nodes and "op" in hugr_json:
        walk(hugr_json, 0)

    return nodes


# ── Source-level fallback ──────────────────────────────────────────────────

def infer_nodes_from_source(source: str) -> list[dict]:
    """
    Approximate HUGR node list derived purely from source analysis.
    Used when real HUGR extraction is unavailable.
    """
    nodes: list[dict] = []
    nid = [0]

    def add(type_: str, name: str, meta: str, depth: int) -> None:
        nodes.append({"id": str(nid[0]), "type": type_, "name": name,
                       "meta": meta, "depth": depth, "parent": None})
        nid[0] += 1

    gate_ops    = {"h", "cx", "cz", "x", "y", "z", "s", "t", "toffoli",
                   "rx", "ry", "rz", "ch", "swap"}
    measure_ops = {"measure", "measure_array"}

    add("DFG", "module", "root", 0)

    fn_pat = re.compile(
        r"@guppy(?:\.[^\n]*)?\ndef\s+(\w+)\s*\(([^)]*)\)\s*->\s*([^:]+):",
        re.MULTILINE,
    )

    for m in fn_pat.finditer(source):
        fn_name = m.group(1)
        fn_args = m.group(2).strip()
        fn_ret  = m.group(3).strip()
        add("FuncDef", fn_name, f"({fn_args}) → {fn_ret}", 1)

        start   = m.end()
        next_fn = fn_pat.search(source, start)
        body    = source[start: next_fn.start() if next_fn else len(source)]

        seen: set[str] = set()
        for call_m in re.finditer(r"\b(\w+)\s*\(", body):
            op = call_m.group(1).lower()
            if op in gate_ops and op not in seen:
                add("Gate", op.upper(), "", 2)
                seen.add(op)
            elif op in measure_ops and op not in seen:
                add("Measure", op, "→ bool", 2)
                seen.add(op)

    return nodes


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    payload     = json.loads(sys.stdin.read())
    source: str = payload["source"]

    # Write source to a real file — guppylang uses inspect.getsourcelines()
    # which requires a file on disk (not -c or exec'd strings)
    tmpfile = tempfile.NamedTemporaryFile(
        suffix=".py", mode="w", delete=False, prefix="guppy_user_"
    )
    tmppath = tmpfile.name
    try:
        tmpfile.write(source)
        tmpfile.close()

        spec = importlib.util.spec_from_file_location("_guppy_user", tmppath)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not create module spec for {tmppath}")

        module = importlib.util.module_from_spec(spec)

        hugr_json_str = "{}"
        hugr_nodes: list[dict] = []
        warnings: list[dict]   = []

        try:
            spec.loader.exec_module(module)  # type: ignore[union-attr]
        except SystemExit:
            pass  # Some examples call sys.exit() — treat as success

        # Walk module attrs for GuppyFunctionDefinition objects and compile them
        try:
            from guppylang.defs import GuppyFunctionDefinition
            from hugr.package import Package
            for attr_name in dir(module):
                obj = getattr(module, attr_name, None)
                if isinstance(obj, GuppyFunctionDefinition):
                    try:
                        pkg = obj.compile()
                        # Use modern HUGR envelope API (to_str/from_str)
                        hugr_json_str = pkg.to_str()
                        # Try to extract nodes from the JSON form for display
                        try:
                            hugr_dict = json.loads(pkg.to_json())
                            hugr_nodes = extract_hugr_nodes(hugr_dict)
                        except Exception:
                            hugr_nodes = infer_nodes_from_source(source)
                        break
                    except Exception:
                        pass
        except ImportError:
            pass

        # Fall back to source-level analysis if HUGR extraction produced nothing
        if not hugr_nodes:
            hugr_nodes = infer_nodes_from_source(source)

        print(json.dumps({
            "status":     "ok",
            "hugr_json":  hugr_json_str,   # string — passed to simulate worker
            "hugr_nodes": hugr_nodes,
            "warnings":   warnings,
        }))

    except Exception as exc:
        tb_str = traceback.format_exc()
        errors = parse_guppy_errors(exc, tb_str)
        print(json.dumps({"status": "error", "errors": errors}))

    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass


if __name__ == "__main__":
    main()
