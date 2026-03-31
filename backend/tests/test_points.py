import pytest
from app.services.points import calc_task_points, calc_shields
from app.models.program import TaskDefinition, TaskType
from app.models.daily_log import TaskCompletion


def _task(type=TaskType.boolean, target=None, cp=100, bp=50, btp=1.5, is_required=False):
    return TaskDefinition(
        id="t1", program_id="p1", name="T", category="fitness",
        type=type, target_value=target, completion_points=cp,
        bonus_points=bp, bonus_threshold_pct=btp, is_required=is_required,
    )


def test_boolean_complete():
    task = _task(TaskType.boolean)
    tc = TaskCompletion(task_id="t1", completed=True)
    result = calc_task_points(task, tc)
    assert result.points_earned == 100
    assert result.bonus_earned is False


def test_boolean_incomplete():
    task = _task(TaskType.boolean)
    tc = TaskCompletion(task_id="t1", completed=False)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0


def test_duration_meets_target():
    task = _task(TaskType.duration, target=20)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=20)
    result = calc_task_points(task, tc)
    assert result.points_earned == 100
    assert result.bonus_earned is False


def test_duration_earns_bonus():
    task = _task(TaskType.duration, target=20)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=31)  # >= 20*1.5=30
    result = calc_task_points(task, tc)
    assert result.points_earned == 150
    assert result.bonus_earned is True


def test_duration_partial_no_points():
    task = _task(TaskType.duration, target=20, cp=100)
    # min_completion_pct=1.0 by default, so 19 min = 0 points
    tc = TaskCompletion(task_id="t1", completed=False, logged_value=19)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0


def test_shields_calculation():
    assert calc_shields(total_points=3000, points_per_shield=1500, shields_used=0) == 2
    assert calc_shields(total_points=3000, points_per_shield=1500, shields_used=1) == 1
    assert calc_shields(total_points=1499, points_per_shield=1500, shields_used=0) == 0


def test_shields_cannot_go_negative():
    assert calc_shields(total_points=1500, points_per_shield=1500, shields_used=5) == 0


def test_required_task_earns_zero_points():
    task = _task(TaskType.boolean, cp=100, bp=50, is_required=True)
    tc = TaskCompletion(task_id="t1", completed=True)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0
    assert result.bonus_earned is False


def test_optional_task_earns_points():
    task = _task(TaskType.boolean, cp=100, bp=0, is_required=False)
    tc = TaskCompletion(task_id="t1", completed=True)
    result = calc_task_points(task, tc)
    assert result.points_earned == 100


def test_required_duration_task_earns_zero():
    task = _task(TaskType.duration, target=20, cp=100, bp=50, is_required=True)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=31)
    result = calc_task_points(task, tc)
    assert result.points_earned == 0
    assert result.bonus_earned is False


def test_optional_duration_task_earns_bonus():
    task = _task(TaskType.duration, target=20, cp=100, bp=50, is_required=False)
    tc = TaskCompletion(task_id="t1", completed=True, logged_value=31)
    result = calc_task_points(task, tc)
    assert result.points_earned == 150
    assert result.bonus_earned is True
