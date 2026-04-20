"""FastAPI application factory."""
from __future__ import annotations

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routes import run, health, examples

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("guppy_playground")

settings = get_settings()

app = FastAPI(
    title="Guppy Playground API",
    description="Compile and simulate Guppy quantum programs using Selene.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
    allow_credentials=False,
)

# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(run.router,      tags=["execution"])
app.include_router(health.router,   tags=["meta"])
app.include_router(examples.router, tags=["content"])


# ── Global error handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s", request.url)
    return JSONResponse(
        status_code=500,
        content={"status": "internal_error", "message": "An unexpected error occurred."},
    )


# ── Startup ───────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup() -> None:
    logger.info("Guppy Playground API starting up")
    logger.info("Allowed origins: %s", settings.origins_list)

    try:
        import guppylang
        logger.info("guppylang %s loaded ✓", guppylang.__version__)
    except ImportError:
        logger.warning("guppylang not installed — compilation will fail")

    try:
        import selene_sim  # noqa
        logger.info("selene_sim loaded ✓")
    except ImportError:
        logger.warning("selene_sim not installed — simulation will use mock output")


@app.on_event("shutdown")
async def shutdown() -> None:
    logger.info("Guppy Playground API shutting down")
