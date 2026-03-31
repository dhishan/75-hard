import math
from datetime import date
from app.models.user_program import UserProgram, PenaltyEvent


def compute_penalty(up: UserProgram, failure_number: int) -> int:
    """Return days to add for failure_number-th failure. Formula: 2^(N-1)."""
    return 2 ** (failure_number - 1)


def apply_to_user_program(
    up: UserProgram,
    missed_task_ids: list[str],
    log_date: date,
) -> tuple[UserProgram, PenaltyEvent]:
    up = up.model_copy(deep=True)
    failure_number = up.failure_count + 1
    penalty_mode = up.program_snapshot.get("penalty_mode", "exponential")
    points_per_shield = up.program_snapshot.get("points_per_shield", 1500)

    use_shield = up.shield_tokens_available > 0
    days_added = 0
    reset_triggered = False

    if use_shield:
        up.total_points_earned -= points_per_shield
        up.shields_used += 1
        up.shield_tokens_available = math.floor(up.total_points_earned / points_per_shield)
    else:
        if penalty_mode == "reset":
            up.current_day = 1
            up.total_days_required = up.base_days
            up.failure_count += 1
            reset_triggered = True
        else:  # exponential
            days_added = compute_penalty(up, failure_number)
            up.failure_count += 1
            up.total_days_required += days_added

    event = PenaltyEvent(
        date=log_date,
        failure_number=failure_number,
        days_added=days_added,
        missed_task_ids=missed_task_ids,
        shield_used=use_shield,
        reset_triggered=reset_triggered,
    )
    up.penalty_log.append(event)
    return up, event
