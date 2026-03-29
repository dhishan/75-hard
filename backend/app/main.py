"""FastAPI application entry point for 75 Hard Challenge Tracker."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(
    title="75 Hard Challenge Tracker API",
    description="Backend API for tracking the 75 Hard challenge progress",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint used by Cloud Run and load balancers."""
    return {"status": "ok", "environment": settings.environment}


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "75 Hard Challenge Tracker API"}
