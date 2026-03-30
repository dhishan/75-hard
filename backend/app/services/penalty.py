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
    """
    Record a failure event on up. Consumes a shield if available.
    Returns (updated_user_program, penalty_event).
    """
    up = up.model_copy(deep=True)
    failure_number = up.failure_count + 1

    use_shield = up.shield_tokens_available > 0

    if use_shield:
        days_added = 0
        up.shield_tokens_available -= 1
        up.shields_used += 1
    else:
        days_added = compute_penalty(up, failure_number)
        up.failure_count += 1
        up.total_days_required += days_added

    event = PenaltyEvent(
        date=log_date,
        failure_number=failure_number,
        days_added=days_added,
        missed_task_ids=missed_task_ids,
        shield_used=use_shield,
    )
    up.penalty_log.append(event)

    return up, event
