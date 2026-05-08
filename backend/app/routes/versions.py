from fastapi import APIRouter
from ..config import COMPATIBLE_VERSIONS, DEFAULT_VERSION
from ..models import VersionsResponse

router = APIRouter()


@router.get("/versions", response_model=VersionsResponse)
async def versions() -> VersionsResponse:
    tested = {v: d for v, d in COMPATIBLE_VERSIONS.items() if d["tested"]}
    return VersionsResponse(
        versions=list(tested.keys()),
        default_version=DEFAULT_VERSION,
        version_deps={v: d["selene_sim"] for v, d in tested.items()},
    )
