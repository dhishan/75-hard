from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel


class Evidence(BaseModel):
    id: str = ""
    type: str  # "photo" | "note"
    url: str | None = None
    caption: str | None = None
    created_at: datetime = datetime.utcnow()


class TaskCompletion(BaseModel):
    task_id: str
    completed: bool = False
    logged_value: float | None = None
    logged_unit: str | None = None
    selected_option: str | None = None
    bonus_earned: bool = False
    points_earned: int = 0
    completed_at: datetime | None = None
    notes: str | None = None
    evidence: list[Evidence] = []


class DailyLog(BaseModel):
    user_program_id: str = ""
    date: date
    is_complete: bool = False
    penalty_applied: int = 0
    task_completions: list[TaskCompletion] = []
    summary_points: int = 0


class DailyLogUpsert(BaseModel):
    task_completions: list[TaskCompletion]
