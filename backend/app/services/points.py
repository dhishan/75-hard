from app.models.program import TaskDefinition, TaskType
from app.models.daily_log import TaskCompletion
import math


def calc_task_points(task: TaskDefinition, tc: TaskCompletion) -> TaskCompletion:
    """Compute points_earned and bonus_earned for a single task completion. Returns updated tc."""
    tc = tc.model_copy()

    # Required tasks never earn points — only determine completion status
    if task.is_required:
        tc.points_earned = 0
        tc.bonus_earned = False
        if task.type == TaskType.budget:
            logged = tc.logged_value or 0
            tc.completed = task.total_budget is not None and logged <= task.total_budget
        elif task.type == TaskType.boolean:
            pass  # tc.completed already set by caller
        elif task.target_value is not None:
            logged = tc.logged_value or 0
            if getattr(task, 'target_direction', 'min') == 'max':
                tc.completed = logged <= task.target_value
            else:
                tc.completed = logged >= task.target_value * task.min_completion_pct
        return tc

    # Optional tasks: existing logic
    if task.type != TaskType.budget and not tc.completed and tc.logged_value is None:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    if task.type == TaskType.budget:
        logged = tc.logged_value or 0
        met = task.total_budget is not None and logged <= task.total_budget
        tc.completed = met
    elif task.type == TaskType.boolean:
        met = tc.completed
    elif task.target_value is not None:
        logged = tc.logged_value or 0
        if getattr(task, 'target_direction', 'min') == 'max':
            met = logged <= task.target_value
        else:
            met = logged >= task.target_value * task.min_completion_pct
        tc.completed = met
    else:
        met = tc.completed

    if not met:
        tc.points_earned = 0
        tc.bonus_earned = False
        return tc

    tc.points_earned = task.completion_points

    if task.target_value is not None and task.bonus_points > 0:
        threshold = task.target_value * task.bonus_threshold_pct
        logged = tc.logged_value or 0
        if logged >= threshold:
            tc.bonus_earned = True
            tc.points_earned += task.bonus_points

    return tc


def calc_shields(total_points: int, points_per_shield: int) -> int:
    """Return available shield tokens based on current total_points."""
    return math.floor(total_points / points_per_shield)
