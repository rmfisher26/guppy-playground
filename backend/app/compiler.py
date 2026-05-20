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
from dataclasses import dataclass
from pathlib import Path

from .config import COMPATIBLE_VERSIONS, DEFAULT_VERSION, SUPPORTED_VERSIONS
from .models import (
    CompileError, CompileSuccess, CompileWarning,
    ErrorKind, HugrNode, SimulationResults, StateSnapshot, StateTracedState,
)
from .sandbox import run_subprocess


@dataclass
class WorkerResult:
    compile: CompileSuccess | None
    results: SimulationResults | None
    errors: list[CompileError] | None
    stdout: str | None

WORKER = Path(__file__).parent / "_compile_worker.py"
TIMEOUT = 60  # compile + simulate together; give generous budget


def _worker_command(version: str | None) -> list[str]:
    """Return the subprocess command for the given guppylang version.

    Uses the current venv's interpreter for the default version (fast path),
    and uv to spin up an isolated environment for alternate versions.
    """
    if version is None or version == DEFAULT_VERSION:
        return [sys.executable, str(WORKER)]
    selene_ver = COMPATIBLE_VERSIONS[version]["selene_sim"]
    return [
        "uv", "run",
        "--with", f"guppylang=={version}",
        "--with", f"selene-sim=={selene_ver}",
        str(WORKER),
    ]


async def compile_and_simulate(
    source: str,
    shots: int,
    simulator: str,
    seed: int | None = None,
    entry_point: str | None = None,
    filename: str = "main.py",
    noise_model: str | None = None,
    error_rate: float = 0.001,
    version: str | None = None,
    compile_only: bool = False,
) -> WorkerResult:
    """Compile (and optionally simulate) a Guppy program in one sandboxed subprocess."""
    if version is not None and version not in SUPPORTED_VERSIONS:
        return WorkerResult(
            compile=None, results=None, stdout=None,
            errors=[CompileError(
                message=f"Unsupported guppylang version: {version!r}",
                line=1,
                kind=ErrorKind.internal_error,
            )],
        )

    t0 = time.monotonic()

    result = await run_subprocess(
        _worker_command(version),
        input_data=json.dumps({
            "source":       source,
            "filename":     filename,
            "shots":        shots,
            "simulator":    simulator,
            "seed":         seed,
            "noise_model":  noise_model,
            "error_rate":   error_rate,
            "version":      version,
            "compile_only": compile_only,
        }),
        timeout=TIMEOUT,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    def _err(msg: str, kind: ErrorKind = ErrorKind.internal_error) -> WorkerResult:
        return WorkerResult(
            compile=None, results=None, stdout=None,
            errors=[CompileError(message=msg, line=1, kind=kind)],
        )

    if result.timed_out:
        return _err(f"Execution timed out after {TIMEOUT}s")

    if not result.stdout.strip():
        return _err(result.stderr[:400] or "Worker produced no output")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return _err((result.stderr or result.stdout)[:400])

    user_stdout: str | None = data.get("stdout") or None

    if data.get("status") == "error":
        return WorkerResult(
            compile=None, results=None, stdout=user_stdout,
            errors=[
                CompileError(
                    message=e["message"],
                    line=e.get("line", 1),
                    col=e.get("col", 0),
                    kind=ErrorKind(e.get("kind", "internal_error")),
                )
                for e in data.get("errors", [])
            ],
        )

    nodes       = [HugrNode(**n) for n in data.get("hugr_nodes", [])]
    warnings    = [CompileWarning(**w) for w in data.get("warnings", [])]
    qubit_count = data.get("qubit_count", 2)

    compile_ok = CompileSuccess(
        hugr_json=data.get("hugr_json"),
        hugr_nodes=nodes,
        node_count=len(nodes),
        qubit_count=qubit_count,
        warnings=warnings,
        compile_time_ms=elapsed_ms,
    )

    # compile-only: skip building SimulationResults.
    # Empty counts means the worker auto-switched (e.g. qubit-param function) — treat the same way.
    if compile_only or not data.get("counts"):
        return WorkerResult(compile=compile_ok, results=None, errors=None, stdout=user_stdout)

    raw_snaps = data.get("state_snapshots")
    state_snapshots = None
    if raw_snaps:
        state_snapshots = [
            [
                StateSnapshot(
                    tag=snap["tag"],
                    num_qubits=snap["num_qubits"],
                    specified_qubits=snap["specified_qubits"],
                    distribution=[
                        StateTracedState(
                            probability=entry["probability"],
                            amplitudes=entry["amplitudes"],
                        )
                        for entry in snap["distribution"]
                    ],
                )
                for snap in shot
            ]
            for shot in raw_snaps
        ]

    sim_ok = SimulationResults(
        counts=data.get("counts", {}),
        noisy_counts=data.get("noisy_counts"),
        register_names=data.get("register_names"),
        simulate_time_ms=elapsed_ms,
        state_snapshots=state_snapshots,
    )

    return WorkerResult(compile=compile_ok, results=sim_ok, errors=None, stdout=user_stdout)
