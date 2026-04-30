from __future__ import annotations
import logging
import uuid
from fastapi import APIRouter, Request
from ..models import RunRequest, RunResponse, RunStatus
from ..compiler import compile_and_simulate

logger = logging.getLogger("guppy_playground.run")

router = APIRouter()


@router.post("/run", response_model=RunResponse)
async def run_endpoint(req: RunRequest, http_req: Request) -> RunResponse:
    request_id = str(uuid.uuid4())[:8]
    source_preview = req.source[:60].replace("\n", " ").strip()

    logger.info(
        "[%s] POST /run  simulator=%s  shots=%d  source=%r",
        request_id, req.simulator, req.shots, source_preview,
    )

    result = await compile_and_simulate(
        source=req.source,
        shots=req.shots,
        simulator=req.simulator,
        seed=req.seed,
        entry_point=req.entry_point,
        filename=req.filename,
    )

    if isinstance(result, list):
        logger.warning(
            "[%s] compile_error  errors=%d  first=%r",
            request_id,
            len(result),
            result[0].message if result else "none",
        )
        return RunResponse(
            status=RunStatus.compile_error,
            errors=result,
            request_id=request_id,
        )

    compile_ok, sim_ok = result
    total_shots = sum(sim_ok.counts.values())

    logger.info(
        "[%s] ok  nodes=%d  qubits=%d  shots=%d  outcomes=%d  ms=%d",
        request_id,
        compile_ok.node_count,
        compile_ok.qubit_count,
        total_shots,
        len(sim_ok.counts),
        compile_ok.compile_time_ms,
    )

    return RunResponse(
        status=RunStatus.ok,
        compile=compile_ok,
        results=sim_ok,
        request_id=request_id,
    )
