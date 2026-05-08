"""
Compile + simulate Guppy source in a single sandboxed subprocess call.

Both steps run in the same worker process because the guppylang emulator API
requires the @guppy function object to be live in the same Python process that
calls .emulator().run() — HUGR alone cannot carry the live function object
across a process boundary.

Worker protocol
---------------
stdin:  JSON  { source, filename, shots, simulator, seed, noise_model, error_rate }
stdout: JSON  { status: "ok" | "error", ...fields }   (see _compile_worker.py)
stderr: captured for diagnostics only; never trusted as structured data
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
TIMEOUT = 60  # compile + simulate together; give generous budget


async def compile_and_simulate(
    source: str,
    shots: int,
    simulator: str,
    seed: int | None = None,
    entry_point: str | None = None,
    filename: str = "main.py",
    noise_model: str | None = None,
    error_rate: float = 0.001,
) -> tuple[CompileSuccess, SimulationResults] | list[CompileError]:
    """Compile and simulate a Guppy program in one sandboxed subprocess.

    Args:
        source:      Raw Guppy Python source code.
        shots:       Number of measurement shots to simulate.
        simulator:   Simulator backend name (e.g. "stabilizer", "statevector").
        seed:        Optional RNG seed for reproducible results.
        entry_point: Name of the @guppy function to run (defaults to worker heuristic).
        filename:    Filename reported in compile error messages.
        noise_model: Noise model kind ("depolarizing") or None for ideal simulation.
        error_rate:  Per-gate error probability for the noise model.

    Returns:
        ``(CompileSuccess, SimulationResults)`` on success, or
        ``list[CompileError]`` if compilation or simulation fails.
    """
    t0 = time.monotonic()

    result = await run_subprocess(
        [sys.executable, str(WORKER)],
        input_data=json.dumps({
            "source":      source,
            "filename":    filename,
            "shots":       shots,
            "simulator":   simulator,
            "seed":        seed,
            "noise_model": noise_model,
            "error_rate":  error_rate,
        }),
        timeout=TIMEOUT,
    )

    # Covers both compile + simulate — the worker does them in one pass
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
        hugr_json=data.get("hugr_json"),
        hugr_nodes=nodes,
        node_count=len(nodes),
        qubit_count=qubit_count,
        warnings=warnings,
        compile_time_ms=elapsed_ms,
    )

    sim_ok = SimulationResults(
        counts=data.get("counts", {}),
        noisy_counts=data.get("noisy_counts"),
        register_names=data.get("register_names"),
        simulate_time_ms=elapsed_ms,
    )

    return compile_ok, sim_ok
