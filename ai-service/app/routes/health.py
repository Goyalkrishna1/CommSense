from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint — verifies the AI service is running."""
    return {"status": "ok", "message": "AI service is running"}
