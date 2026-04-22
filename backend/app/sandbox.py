"""
Sandboxed subprocess execution for the compile+simulate worker.

Enforces:
  - Wall-clock timeout (asyncio.wait_for)
  - Container-level memory via docker-compose mem_limit (see docker-compose.yml)

RLIMIT_AS is intentionally NOT set here.
guppylang pulls in numpy + OpenBLAS which need ~400 MB of virtual address
space just to import. Setting RLIMIT_AS to anything under ~600 MB causes
OpenBLAS to fail with "Memory allocation still failed after 10 retries"
before any user code runs. Docker's mem_limit on the container is the
correct place to enforce the memory ceiling — it uses cgroups and applies
to the whole container cleanly without breaking library imports.
"""
from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass

TIMEOUT_SECONDS = 30  # compile + simulate together


@dataclass
class SubprocessResult:
    stdout:     str
    stderr:     str
    returncode: int
    timed_out:  bool = False


async def run_subprocess(
    args: list[str],
    input_data: str | None = None,
    timeout: float = TIMEOUT_SECONDS,
    env: dict[str, str] | None = None,
) -> SubprocessResult:
    """Run a subprocess with a wall-clock timeout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE if input_data else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    except FileNotFoundError as exc:
        return SubprocessResult(stdout="", stderr=str(exc), returncode=127)

    try:
        stdin_bytes = input_data.encode() if input_data else None
        stdout_b, stderr_b = await asyncio.wait_for(
            proc.communicate(input=stdin_bytes),
            timeout=timeout,
        )
        return SubprocessResult(
            stdout=stdout_b.decode(errors="replace"),
            stderr=stderr_b.decode(errors="replace"),
            returncode=proc.returncode or 0,
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        return SubprocessResult(
            stdout="", stderr=f"Execution timed out after {timeout}s",
            returncode=-1, timed_out=True,
        )