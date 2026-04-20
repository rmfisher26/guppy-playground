import time
from fastapi import APIRouter
from ..models import HealthResponse

router = APIRouter()

_start_time = time.monotonic()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    guppy_ver = _get_version("guppylang")
    sel_ver   = _get_version("selene_sim")

    status = "ok" if guppy_ver != "unavailable" else "degraded"

    return HealthResponse(
        status=status,
        guppylang_version=guppy_ver,
        selene_version=sel_ver,
        uptime_seconds=time.monotonic() - _start_time,
    )


def _get_version(package: str) -> str:
    try:
        import importlib.metadata
        return importlib.metadata.version(package)
    except Exception:
        try:
            mod = __import__(package)
            return getattr(mod, "__version__", "installed")
        except ImportError:
            return "unavailable"
