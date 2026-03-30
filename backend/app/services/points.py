from app.models.program import TaskDefinition, TaskType
from app.models.daily_log import TaskCompletion
import math


def calc_task_points(task: TaskDefinition, tc: TaskCompletion) -> TaskCompletion:
    """Compute points_earned and bonus_earned for a single task completion. Returns updated tc."""
    tc = tc.model_copy()

    # Budget tasks are always evaluated (logged_value=None means 0 usage → within budget)
    if task.type != TaskType.budget and not tc.completed and tc.logged_value is None:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    # Determine if target is met
    if task.type == TaskType.budget:
        logged = tc.logged_value or 0
        met = task.total_budget is not None and logged <= task.total_budget
        tc.completed = met
    elif task.type == TaskType.boolean:
        met = tc.completed
    elif task.target_value is not None:
        logged = tc.logged_value or 0
        met = logged >= task.target_value * task.min_completion_pct
        tc.completed = met
    else:
        met = tc.completed

    if not met:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    tc.points_earned = task.completion_points

    # Check bonus
    if task.target_value is not None and task.bonus_points > 0:
        threshold = task.target_value * task.bonus_threshold_pct
        logged = tc.logged_value or 0
        if logged >= threshold:
            tc.bonus_earned = True
            tc.points_earned += task.bonus_points

    return tc


def calc_shields(total_points: int, points_per_shield: int, shields_used: int) -> int:
    """Return available shield tokens (earned minus spent)."""
    earned = math.floor(total_points / points_per_shield)
    return max(0, earned - shields_used)
