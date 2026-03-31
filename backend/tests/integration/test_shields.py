"""
Scenarios:
  1. 5 perfect days with all optionals (45*5=225 pts, threshold=200) → shield_tokens_available=1
  2. 6th day failure with shield available → shield absorbed, days unchanged
  3. After shield use: shield_tokens_available=0, shields_used=1, failure_count unchanged
  4. Without enough points (4 days × 45 = 180 < 200), no shield earned
"""
import pytest
from datetime import date
from tests.integration.conftest import create_sample_program, start_run, make_completions

pytestmark = pytest.mark.asyncio


ALL_OPTIONAL_OVERRIDES = {
    "Weight":               {"completed": True, "logged_value": 75.0, "logged_unit": "kg"},
    "News/Finance/Podcast": {"completed": True, "selected_option": "news"},
    "Skin care":            {"completed": True},
}


@pytest.fixture
async def program_and_run(client, auth_headers, created_program_ids, created_up_ids, cleanup):
    data = await create_sample_program(client, auth_headers)
    created_program_ids.append(data["program"]["id"])
    run = await start_run(client, auth_headers, data["program"]["id"], date(2026, 3, 1))
    created_up_ids.append(run["id"])
    yield data["program"], data["tasks"], run


async def _log_perfect_days(client, auth_headers, up_id: str, tasks: list, dates: list[str]):
    """Log multiple perfect days with all tasks (required + optionals) to accumulate points."""
    for d in dates:
        resp = await client.put(
            f"/api/v1/user-programs/{up_id}/logs/{d}",
            json={"task_completions": make_completions(tasks, overrides=ALL_OPTIONAL_OVERRIDES)},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_complete"] is True, f"Day {d} should be complete"


async def test_earn_shield_after_5_perfect_days(program_and_run, client, auth_headers):
    """5 perfect days with all optionals = 225 pts (45*5) → 1 shield token (floor(225/200)=1)."""
    _prog, tasks, run = program_and_run

    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ])

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_points_earned"] == 225  # 45 * 5
    assert up["shield_tokens_available"] == 1  # floor(225/200) = 1


async def test_shield_absorbs_penalty(program_and_run, client, auth_headers):
    """After earning shield, incomplete day → shield consumed, no days added."""
    _prog, tasks, run = program_and_run

    # Earn shield
    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ])

    # Fail day 6 — shield should absorb
    fail_completions = make_completions(tasks, overrides={"No added sugar": {"completed": False}})
    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-03-06",
        json={"task_completions": fail_completions},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()
    assert log["is_complete"] is False
    assert log["penalty_applied"] == 0  # shield absorbed

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_days_required"] == 75  # unchanged
    assert up["shield_tokens_available"] == 0  # consumed
    assert up["shields_used"] == 1
    assert up["failure_count"] == 0  # shield-absorbed failures don't count


async def test_no_shield_when_points_below_threshold(program_and_run, client, auth_headers):
    """Only 4 days logged (180 pts) → no shield yet (need 200)."""
    _prog, tasks, run = program_and_run

    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
    ])

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_points_earned"] == 180  # 45 * 4
    assert up["shield_tokens_available"] == 0  # 180 < 200


async def test_second_failure_after_shield_used_adds_penalty(program_and_run, client, auth_headers):
    """After shield absorbs failure #1, next failure (shield gone) adds +1 day."""
    _prog, tasks, run = program_and_run

    # Earn shield
    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ])

    # Shielded failure
    await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-03-06",
        json={"task_completions": make_completions(tasks, overrides={"No added sugar": {"completed": False}})},
        headers=auth_headers,
    )

    # Unshielded failure — shield is gone, failure_count=0 so this is failure #1 → +1 day
    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-03-07",
        json={"task_completions": make_completions(tasks, overrides={"Workout": {"completed": False, "logged_value": 5}})},
        headers=auth_headers,
    )
    assert resp.json()["penalty_applied"] == 1  # failure_count was 0 → 2^0 = 1

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_days_required"] == 76
    assert up["failure_count"] == 1
