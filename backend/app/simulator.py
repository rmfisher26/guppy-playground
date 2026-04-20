"""Wraps selene-sim execution in a sandboxed subprocess."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from .models import SimulationResults, SimulatorBackend
from .sandbox import run_subprocess

SIMULATE_WORKER = Path(__file__).parent / "_simulate_worker.py"

SIM_TIMEOUT = 15  # seconds — longer than compile; statevector can be slow


async def simulate(
    hugr_json: str | dict,
    shots: int,
    simulator: SimulatorBackend,
    seed: int | None = None,
) -> SimulationResults:
    """Run Selene simulation in a sandboxed subprocess.

    hugr_json may be a JSON string (from compile worker) or a dict.
    """
    t0 = time.monotonic()

    # Normalise to string — simulate worker expects a JSON string
    hugr_str = hugr_json if isinstance(hugr_json, str) else json.dumps(hugr_json)

    result = await run_subprocess(
        [sys.executable, str(SIMULATE_WORKER)],
        input_data=json.dumps({
            "hugr_json": hugr_str,
            "shots":     shots,
            "simulator": simulator,
            "seed":      seed,
        }),
        timeout=SIM_TIMEOUT,
    )

    elapsed_ms = int((time.monotonic() - t0) * 1000)

    if result.timed_out:
        raise TimeoutError(f"Simulation exceeded {SIM_TIMEOUT}s limit")

    if not result.stdout.strip():
        raise RuntimeError(result.stderr[:300] or "Simulator produced no output")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Simulator output was not valid JSON: {result.stdout[:200]}") from exc

    if data.get("status") == "error":
        raise RuntimeError(data.get("message", "Simulation failed"))

    return SimulationResults(
        counts=data["counts"],
        expectation_values=data.get("expectation_values"),
        statevector=data.get("statevector"),
        simulate_time_ms=elapsed_ms,
    )
