from __future__ import annotations
import uuid
from fastapi import APIRouter
from ..models import RunRequest, RunResponse, RunStatus
from ..compiler import compile_and_simulate

router = APIRouter()


@router.post("/run", response_model=RunResponse)
async def run_endpoint(req: RunRequest) -> RunResponse:
    request_id = str(uuid.uuid4())[:8]

    result = await compile_and_simulate(
        source=req.source,
        shots=req.shots,
        simulator=req.simulator,
        seed=req.seed,
        entry_point=req.entry_point,
    )

    # compile_and_simulate returns list[CompileError] on any failure
    if isinstance(result, list):
        return RunResponse(
            status=RunStatus.compile_error,
            errors=result,
            request_id=request_id,
        )

    compile_ok, sim_ok = result
    return RunResponse(
        status=RunStatus.ok,
        compile=compile_ok,
        results=sim_ok,
        request_id=request_id,
    )
