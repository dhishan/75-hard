from __future__ import annotations
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    boolean = "boolean"
    duration = "duration"
    count = "count"
    measurement = "measurement"
    budget = "budget"


class TaskDefinition(BaseModel):
    id: str = ""
    program_id: str = ""
    name: str
    description: str | None = None
    category: str
    icon: str | None = None
    order: int = 0
    type: TaskType
    target_value: float | None = None
    unit: str | None = None
    min_completion_pct: float = 1.0
    total_budget: int | None = None
    warn_at_pct: float | None = 0.8
    sub_options: list[str] = []
    times_per_day: int = 1
    is_required: bool = True
    completion_points: int = 0
    bonus_points: int = 0
    bonus_threshold_pct: float = 1.0
    evidence_required: bool = False
    evidence_types: list[str] = []
    tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TaskDefinitionCreate(BaseModel):
    name: str
    description: str | None = None
    category: str
    icon: str | None = None
    order: int = 0
    type: TaskType
    target_value: float | None = None
    unit: str | None = None
    min_completion_pct: float = 1.0
    total_budget: int | None = None
    warn_at_pct: float | None = 0.8
    sub_options: list[str] = []
    times_per_day: int = 1
    is_required: bool = True
    completion_points: int = 0
    bonus_points: int = 0
    bonus_threshold_pct: float = 1.0
    evidence_required: bool = False
    evidence_types: list[str] = []
    tags: list[str] = []


class Program(BaseModel):
    id: str = ""
    owner_uid: str = ""
    name: str
    description: str | None = None
    is_template: bool = False
    duration_days: int = 75
    penalty_mode: str = "exponential"
    points_per_shield: int = 1500
    max_shields_per_week: int = 1
    max_shields_total: int | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProgramCreate(BaseModel):
    name: str
    description: str | None = None
    is_template: bool = False
    duration_days: int = 75
    points_per_shield: int = 1500
    max_shields_per_week: int = 1
    max_shields_total: int | None = None


class ProgramWithTasks(Program):
    tasks: list[TaskDefinition] = []
