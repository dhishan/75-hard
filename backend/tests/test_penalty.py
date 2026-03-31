from datetime import date
from app.services.penalty import compute_penalty, apply_to_user_program
from app.models.user_program import UserProgram, PenaltyEvent


def _make_up(failure_count=0, shield_tokens=0, shields_used=0, total_days=75):
    return UserProgram(
        id="up1", user_uid="u1", program_id="p1",
        program_snapshot={"penalty_mode": "exponential", "points_per_shield": 1500},
        start_date=date(2026, 1, 1), base_days=75,
        total_days_required=total_days, current_day=1,
        failure_count=failure_count,
        shield_tokens_available=shield_tokens,
        shields_used=shields_used,
        total_points_earned=1500 if shield_tokens > 0 else 0,
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
    up.total_points_earned = 1500
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 2)
    )
    assert event.shield_used is True
    assert event.days_added == 0
    assert updated.total_days_required == 75
    assert updated.total_points_earned == 0
    assert updated.shield_tokens_available == 0
    assert updated.shields_used == 1
    assert updated.failure_count == 0


def test_no_shield_penalty_extends_program():
    up = _make_up(failure_count=0, shield_tokens=0)
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 2)
    )
    assert event.shield_used is False
    assert event.days_added == 1
    assert updated.total_days_required == 76
    assert updated.failure_count == 1


def _make_up_with_mode(penalty_mode="exponential", failure_count=0, shield_tokens=0,
                       shields_used=0, total_days=75, base_days=75,
                       current_day=10, total_points=0, points_per_shield=1500):
    return UserProgram(
        id="up1", user_uid="u1", program_id="p1",
        program_snapshot={"penalty_mode": penalty_mode, "points_per_shield": points_per_shield},
        start_date=date(2026, 1, 1), base_days=base_days,
        total_days_required=total_days, current_day=current_day,
        failure_count=failure_count,
        shield_tokens_available=shield_tokens,
        shields_used=shields_used,
        total_points_earned=total_points,
    )


def test_reset_mode_resets_program():
    up = _make_up_with_mode(penalty_mode="reset", current_day=30, total_days=80, base_days=75)
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 31))
    assert updated.current_day == 1
    assert updated.total_days_required == 75
    assert updated.failure_count == 1
    assert event.days_added == 0
    assert event.reset_triggered is True


def test_reset_mode_with_shield_no_reset():
    up = _make_up_with_mode(
        penalty_mode="reset", current_day=30, shield_tokens=1,
        total_points=3000, points_per_shield=1500,
    )
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 31))
    assert updated.current_day == 30
    assert event.shield_used is True
    assert event.reset_triggered is False
    assert updated.total_points_earned == 1500
    assert updated.shield_tokens_available == 1
    assert updated.shields_used == 1


def test_exponential_mode_shield_deducts_points():
    up = _make_up_with_mode(
        penalty_mode="exponential", shield_tokens=1,
        total_points=3000, points_per_shield=1500,
    )
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 2))
    assert event.shield_used is True
    assert updated.total_points_earned == 1500
    assert updated.shield_tokens_available == 1
    assert updated.shields_used == 1


def test_exponential_mode_no_shield_adds_days():
    up = _make_up_with_mode(penalty_mode="exponential", failure_count=0, shield_tokens=0)
    updated, event = apply_to_user_program(up, missed_task_ids=["t1"], log_date=date(2026, 1, 2))
    assert event.days_added == 1
    assert updated.failure_count == 1
    assert updated.total_days_required == 76
    assert event.reset_triggered is False


def test_cumulative_penalties():
    up = _make_up(failure_count=2, shield_tokens=0, total_days=78)
    updated, event = apply_to_user_program(
        up, missed_task_ids=["t1"], log_date=date(2026, 1, 5)
    )
    assert event.days_added == 4  # 2^(3-1)
    assert updated.total_days_required == 82
