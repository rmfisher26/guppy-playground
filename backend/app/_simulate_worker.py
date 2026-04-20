"""
Sandboxed simulate worker — runs as a subprocess.

Reads JSON from stdin:
  { "hugr_json": "...(HUGR envelope string)...", "shots": 1024,
    "simulator": "stabilizer"|"statevector", "seed": int|null }

Writes JSON to stdout:
  { "status": "ok",    "counts": {"00": 512, "11": 512} }
  { "status": "error", "message": "..." }

This is the ONLY file that imports selene_sim directly.
"""
from __future__ import annotations
import json
import sys


def main() -> None:
    payload    = json.loads(sys.stdin.read())
    hugr_str:  str       = payload["hugr_json"]
    shots:     int       = payload["shots"]
    simulator: str       = payload["simulator"]
    seed: int | None     = payload.get("seed")

    try:
        run_with_selene(hugr_str, shots, simulator, seed)
    except ImportError:
        emit_mock_results(shots, seed)
    except Exception as exc:
        print(json.dumps({"status": "error", "message": str(exc)[:300]}))


def run_with_selene(hugr_str: str, shots: int, simulator: str, seed: int | None) -> None:
    import selene_sim
    from hugr.package import Package

    # Deserialise HUGR envelope string → Package
    pkg = Package.from_str(hugr_str)

    # Build Selene runner
    runner = selene_sim.build(pkg)

    # Choose backend
    if simulator == "statevector":
        backend = selene_sim.Quest(random_seed=seed)
    else:
        backend = selene_sim.Stim(random_seed=seed)

    # Infer qubit count (selene requires it explicitly)
    n_qubits = infer_qubit_count(hugr_str)

    # run_shots returns an iterator-of-iterators
    # Each inner iterator yields (key: str, value: int|float|bool) tuples
    shots_iter = runner.run_shots(
        backend,
        n_qubits=n_qubits,
        n_shots=shots,
    )

    # Aggregate into counts dict keyed by concatenated measurement bit values
    counts: dict[str, int] = {}
    for shot in shots_iter:
        key = "".join(str(int(v)) for _, v in shot)
        counts[key] = counts.get(key, 0) + 1

    print(json.dumps({"status": "ok", "counts": counts}))


def infer_qubit_count(hugr_str: str) -> int:
    """
    Estimate qubit count from the HUGR envelope string.
    Selene needs this upfront. Falls back to 2 if not determinable.
    """
    import re
    # HUGR envelope is not plain JSON — count qubit-related tokens heuristically
    matches = re.findall(r'"[Qq]ubit"', hugr_str)
    return max(len(matches), 2)


def emit_mock_results(shots: int, seed: int | None) -> None:
    """
    Emit mock Bell pair results when selene_sim is not installed.
    Keeps the full UI flow working in development without the quantum stack.
    """
    import random
    rng = random.Random(seed)
    counts: dict[str, int] = {"00": 0, "11": 0}
    for _ in range(shots):
        counts["11" if rng.random() > 0.5 else "00"] += 1
    print(json.dumps({"status": "ok", "counts": counts, "_mock": True}))


if __name__ == "__main__":
    main()
