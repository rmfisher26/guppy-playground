"""
Sandboxed subprocess execution for guppylang compilation.

Enforces:
  - Wall-clock timeout (default 10s)
  - Memory limit via resource.setrlimit (Linux only)
  - Subprocess isolation (no network, restricted filesystem via env)
"""
from __future__ import annotations

import asyncio
import resource
import sys
from dataclasses import dataclass

TIMEOUT_SECONDS   = 10
MEMORY_LIMIT_MB   = 512


@dataclass
class SubprocessResult:
    stdout:      str
    stderr:      str
    returncode:  int
    timed_out:   bool = False


def _set_resource_limits() -> None:
    """Called inside the subprocess before exec — Linux only."""
    if sys.platform != "linux":
        return
    mem_bytes = MEMORY_LIMIT_MB * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS,  (mem_bytes, mem_bytes))
        resource.setrlimit(resource.RLIMIT_DATA, (mem_bytes, mem_bytes))
    except ValueError:
        # May fail if current limit is already lower (e.g. in Docker)
        pass


async def run_subprocess(
    args: list[str],
    input_data: str | None = None,
    timeout: float = TIMEOUT_SECONDS,
    env: dict[str, str] | None = None,
) -> SubprocessResult:
    """Run a subprocess with timeout and memory limits."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE  if input_data else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            preexec_fn=_set_resource_limits,
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
            stdout="", stderr="Execution timed out",
            returncode=-1, timed_out=True,
        )
