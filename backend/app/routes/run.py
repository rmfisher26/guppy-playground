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
        "[%s] POST /run  simulator=%s  shots=%d  noise=%s  p=%s  version=%s  source=%r",
        request_id, req.simulator, req.shots,
        req.noise_model or "ideal", req.error_rate if req.noise_model else "-",
        req.version or "default",
        source_preview,
    )

    result = await compile_and_simulate(
        source=req.source,
        shots=req.shots,
        simulator=req.simulator,
        seed=req.seed,
        entry_point=req.entry_point,
        filename=req.filename,
        noise_model=req.noise_model,
        error_rate=req.error_rate,
        version=req.version,
        compile_only=req.compile_only,
    )

    if result.errors:
        logger.warning(
            "[%s] compile_error  errors=%d  first=%r",
            request_id,
            len(result.errors),
            result.errors[0].message if result.errors else "none",
        )
        return RunResponse(
            status=RunStatus.compile_error,
            errors=result.errors,
            stdout=result.stdout,
            request_id=request_id,
        )

    compile_ok = result.compile
    sim_ok = result.results
    total_shots = sum(sim_ok.counts.values()) if sim_ok else 0

    logger.info(
        "[%s] ok  nodes=%d  qubits=%d  shots=%d  outcomes=%d  ms=%d",
        request_id,
        compile_ok.node_count if compile_ok else 0,
        compile_ok.qubit_count if compile_ok else 0,
        total_shots,
        len(sim_ok.counts) if sim_ok else 0,
        compile_ok.compile_time_ms if compile_ok else 0,
    )

    return RunResponse(
        status=RunStatus.ok,
        compile=compile_ok,
        results=sim_ok,
        stdout=result.stdout,
        request_id=request_id,
    )
