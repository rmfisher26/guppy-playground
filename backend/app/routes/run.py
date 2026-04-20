from __future__ import annotations
import uuid
from fastapi import APIRouter
from ..models import RunRequest, RunResponse, RunStatus, CompileSuccess
from ..compiler import compile_source
from ..simulator import simulate

router = APIRouter()


@router.post("/run", response_model=RunResponse)
async def run_endpoint(req: RunRequest) -> RunResponse:
    request_id = str(uuid.uuid4())[:8]

    # ── Step 1: Compile ──────────────────────────────────────────────────
    compile_result = await compile_source(req.source, req.entry_point)

    if isinstance(compile_result, list):
        # compile_source returns list[CompileError] on failure
        return RunResponse(
            status=RunStatus.compile_error,
            errors=compile_result,
            request_id=request_id,
        )

    # ── Step 2: Simulate ─────────────────────────────────────────────────
    try:
        results = await simulate(
            hugr_json=compile_result.hugr_json,
            shots=req.shots,
            simulator=req.simulator,
            seed=req.seed,
        )
    except TimeoutError:
        return RunResponse(status=RunStatus.timeout, request_id=request_id)
    except Exception as exc:
        return RunResponse(
            status=RunStatus.internal_error,
            message=str(exc)[:300],
            request_id=request_id,
        )

    return RunResponse(
        status=RunStatus.ok,
        compile=compile_result,
        results=results,
        request_id=request_id,
    )
