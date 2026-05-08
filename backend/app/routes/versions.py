from fastapi import APIRouter
from ..config import SUPPORTED_VERSIONS, DEFAULT_VERSION
from ..models import VersionsResponse

router = APIRouter()


@router.get("/versions", response_model=VersionsResponse)
async def versions() -> VersionsResponse:
    return VersionsResponse(
        versions=SUPPORTED_VERSIONS,
        default_version=DEFAULT_VERSION,
    )
