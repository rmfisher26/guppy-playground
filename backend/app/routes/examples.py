from fastapi import APIRouter
from ..models import ExamplesResponse
from ..examples_data import EXAMPLES

router = APIRouter()


@router.get("/examples", response_model=ExamplesResponse)
async def get_examples() -> ExamplesResponse:
    return ExamplesResponse(examples=EXAMPLES)
