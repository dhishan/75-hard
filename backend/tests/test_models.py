from datetime import date
from app.models.program import Program, TaskDefinition, TaskType
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
