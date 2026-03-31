from __future__ import annotations
from datetime import date, datetime
from pydantic import BaseModel, Field


class PenaltyEvent(BaseModel):
    date: date
    failure_number: int
    days_added: int
    missed_task_ids: list[str]
    shield_used: bool = False
    reset_triggered: bool = False


class UserProgram(BaseModel):
    id: str = ""
    user_uid: str = ""
    program_id: str
    program_snapshot: dict = {}
    start_date: date
    base_days: int = 75
    total_days_required: int = 75
    current_day: int = 1
    status: str = "active"
    failure_count: int = 0
    penalty_log: list[PenaltyEvent] = []
    total_points_earned: int = 0
    shield_tokens_available: int = 0
    shields_used: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserProgramCreate(BaseModel):
    program_id: str
    start_date: date


class UserProgramStartDateUpdate(BaseModel):
    start_date: date
