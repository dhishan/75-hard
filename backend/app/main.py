from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import programs, user_programs, daily_logs, budget, stats, evidence

app = FastAPI(title="75 Hard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(programs.router)
app.include_router(user_programs.router)
app.include_router(daily_logs.router)
app.include_router(budget.router)
app.include_router(stats.router)
app.include_router(evidence.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
