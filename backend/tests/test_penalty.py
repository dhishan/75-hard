from datetime import date
from app.services.penalty import compute_penalty, apply_to_user_program
from app.models.user_program import UserProgram, PenaltyEvent


def _make_up(failure_count=0, shield_tokens=0, shields_used=0, total_days=75):
    return UserProgram(
        id="up1", user_uid="u1", program_id="p1", program_snapshot={},
        start_date=date(2026, 1, 1), base_days=75,
        total_days_required=total_days, current_day=1,
        failure_count=failure_count,
        shield_tokens_available=shield_tokens,
        shields_used=shields_used,
    )


def test_first_failure_adds_1_day():
    up = _make_up(failure_count=0)
    result = compute_penalty(up, failure_number=1)
    assert result == 1  # 2^(1-1) = 1


def test_second_failure_adds_2_days():
    result = compute_penalty(_make_up(failure_count=1), failure_number=2)
    assert result == 2  # 2^(2-1) = 2


def test_third_failure_adds_4_days():
    result = compute_penalty(_make_up(failure_count=2), failure_number=3)
    assert result == 4


def test_eighth_failure_adds_128_days():
    result = compute_penalty(_make_up(failure_count=7), failure_number=8)
    assert result == 128


def test_shield_absorbs_penalty():
    up = _make_up(failure_count=0, shield_tokens=1)
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 2)
    )
    assert event.shield_used is True
    assert event.days_added == 0
    assert updated.total_days_required == 75
    assert updated.shield_tokens_available == 0
    assert updated.shields_used == 1
    assert updated.failure_count == 0  # shield absorbs — failure_count only tracks unshielded failures


def test_no_shield_penalty_extends_program():
    up = _make_up(failure_count=0, shield_tokens=0)
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 2)
    )
    assert event.shield_used is False
    assert event.days_added == 1
    assert updated.total_days_required == 76
    assert updated.failure_count == 1


def test_cumulative_penalties():
    up = _make_up(failure_count=2, shield_tokens=0, total_days=78)
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 5)
    )
    assert event.days_added == 4  # 2^(3-1)
    assert updated.total_days_required == 82
