"""
Compile + simulate in one sandboxed subprocess call.

The worker handles both steps because the guppylang emulator API
requires the @guppy function object to be live in the same Python
process that calls .emulator().run() — you cannot serialise it across
process boundaries via HUGR alone.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from .models import (
    CompileError, CompileSuccess, CompileWarning,
    ErrorKind, HugrNode, SimulationResults,
)
from .sandbox import run_subprocess

WORKER = Path(__file__).parent / "_compile_worker.py"
TIMEOUT = 30  # compile + simulate together; give generous budget


async def compile_and_simulate(
    source: str,
    shots: int,
    simulator: str,
    seed: int | None = None,
    entry_point: str | None = None,
) -> tuple[CompileSuccess, SimulationResults] | list[CompileError]:
    """Run compile + simulate in one sandboxed subprocess.

    Returns (CompileSuccess, SimulationResults) on success,
    or list[CompileError] on compile/runtime failure.
    """
    t0 = time.monotonic()

    result = await run_subprocess(
        [sys.executable, str(WORKER)],
        input_data=json.dumps({
            "source":    source,
            "shots":     shots,
            "simulator": simulator,
            "seed":      seed,
        }),
        timeout=TIMEOUT,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if result.timed_out:
        return [CompileError(
            message=f"Execution timed out after {TIMEOUT}s",
            line=1,
            kind=ErrorKind.internal_error,
        )]

    if not result.stdout.strip():
        msg = result.stderr[:400] or "Worker produced no output"
        return [CompileError(message=msg, line=1, kind=ErrorKind.internal_error)]

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        raw = (result.stderr or result.stdout)[:400]
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

    nodes      = [HugrNode(**n) for n in data.get("hugr_nodes", [])]
    warnings   = [CompileWarning(**w) for w in data.get("warnings", [])]
    qubit_count = data.get("qubit_count", 2)

    compile_ok = CompileSuccess(
        hugr_nodes=nodes,
        node_count=len(nodes),
        qubit_count=qubit_count,
        warnings=warnings,
        compile_time_ms=elapsed_ms,
    )

    sim_ok = SimulationResults(
        counts=data.get("counts", {}),
        simulate_time_ms=elapsed_ms,
    )

    return compile_ok, sim_ok
