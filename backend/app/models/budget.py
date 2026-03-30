from __future__ import annotations
from datetime import date
from pydantic import BaseModel


class BudgetEntry(BaseModel):
    date: date
    amount: float


class BudgetState(BaseModel):
    user_program_id: str = ""
    task_id: str = ""
    total_budget: int
    consumed: float = 0.0
    last_logged_date: date | None = None
    log: list[BudgetEntry] = []
