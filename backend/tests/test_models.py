import pytest
from datetime import date
from app.models.program import Program, TaskDefinition, TaskDefinitionCreate, TaskCategory, TaskFrequency, TaskType
from app.models.user_program import UserProgram, PenaltyEvent
from app.models.daily_log import DailyLog, TaskCompletion
from app.models.budget import BudgetState


def test_program_defaults():
    p = Program(name="Test", owner_uid="u1")
    assert p.duration_days == 75
    assert p.points_per_shield == 1500


def test_task_type_enum():
    t = TaskDefinition(name="Workout", category="fitness", type=TaskType.duration)
    assert t.type == "duration"


def test_daily_log_defaults():
    log = DailyLog(user_program_id="up1", date=date.today())
    assert log.is_complete is False
    assert log.task_completions == []


def test_budget_state():
    b = BudgetState(user_program_id="up1", task_id="t1", total_budget=10)
    assert b.consumed == 0.0


def test_task_category_enum_values():
    valid = ["health", "fitness", "nutrition", "mindset", "personal_development",
             "professional_development", "finance", "relationships", "creativity", "other"]
    for v in valid:
        assert TaskCategory(v) == v


def test_task_frequency_enum_values():
    for v in ["daily", "weekly", "monthly", "period"]:
        assert TaskFrequency(v) == v


def test_task_definition_accepts_frequency():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="fitness",
        type=TaskType.boolean, frequency="weekly",
    )
    assert t.frequency == TaskFrequency.weekly


def test_task_definition_frequency_defaults_daily():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="fitness",
        type=TaskType.boolean,
    )
    assert t.frequency == TaskFrequency.daily


def test_task_definition_create_accepts_frequency():
    t = TaskDefinitionCreate(name="Test", category="fitness", type=TaskType.boolean, frequency="monthly")
    assert t.frequency == TaskFrequency.monthly


def test_task_definition_category_enum():
    t = TaskDefinition(
        id="t1", program_id="p1", name="Test", category="personal_development",
        type=TaskType.boolean,
    )
    assert t.category == TaskCategory.personal_development


def test_task_definition_rejects_invalid_category():
    with pytest.raises(Exception):
        TaskDefinition(
            id="t1", program_id="p1", name="Test", category="invalid_cat",
            type=TaskType.boolean,
        )
