"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import install_error_handlers
from app.api.routers.assessments import router as assessments_router


app = FastAPI(title="SkinSense Reco API")
install_error_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    """Return a dependency-free liveness response for hosting platforms."""

    return {"status": "ok"}


app.include_router(assessments_router)
