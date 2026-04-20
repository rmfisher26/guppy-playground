"""Wraps guppylang compilation in a sandboxed subprocess."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from .models import (
    CompileError,
    CompileSuccess,
    CompileWarning,
    ErrorKind,
    HugrNode,
)
from .sandbox import run_subprocess

COMPILE_WORKER = Path(__file__).parent / "_compile_worker.py"


async def compile_source(
    source: str,
    entry_point: str | None = None,
) -> CompileSuccess | list[CompileError]:
    """Compile Guppy source in a sandboxed subprocess.

    Returns CompileSuccess on success, or a list of CompileErrors on failure.
    """
    t0 = time.monotonic()

    result = await run_subprocess(
        [sys.executable, str(COMPILE_WORKER)],
        input_data=json.dumps({"source": source, "entry_point": entry_point}),
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if result.timed_out:
        return [CompileError(
            message="Compilation timed out (10s limit)",
            line=1,
            kind=ErrorKind.internal_error,
        )]

    if not result.stdout.strip():
        msg = result.stderr[:500] if result.stderr else "Compiler produced no output"
        return [CompileError(message=msg, line=1, kind=ErrorKind.internal_error)]

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raw = (result.stderr or result.stdout)[:500]
        return [CompileError(message=raw, line=1, kind=ErrorKind.internal_error)]

    if data.get("status") == "error":
        return [
            CompileError(
                message=e["message"],
                line=e.get("line", 1),
                col=e.get("col", 0),
                kind=ErrorKind(e.get("kind", "internal_error")),
            )
            for e in data.get("errors", [])
        ]

    nodes    = [HugrNode(**n) for n in data.get("hugr_nodes", [])]
    warnings = [CompileWarning(**w) for w in data.get("warnings", [])]
    # hugr_json comes back as a string from the worker — keep it as-is
    hugr_json_str: str = data.get("hugr_json", "{}")

    return CompileSuccess(
        hugr_json=hugr_json_str,
        hugr_nodes=nodes,
        node_count=len(nodes),
        warnings=warnings,
        compile_time_ms=elapsed_ms,
    )
