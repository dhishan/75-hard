"""
Scenarios:
  1. Required-only perfect day → 325 pts, no penalty
  2. All tasks (required + optionals) → 370 pts
  3. Bonus workout day (31min > 30min threshold) → 375 pts
"""
import pytest
from datetime import date
from tests.integration.conftest import create_sample_program, start_run, make_completions

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def program_and_run(client, auth_headers, created_program_ids, created_up_ids, cleanup):
    data = await create_sample_program(client, auth_headers)
    created_program_ids.append(data["program"]["id"])
    run = await start_run(client, auth_headers, data["program"]["id"], date(2026, 1, 1))
    created_up_ids.append(run["id"])
    yield data["program"], data["tasks"], run


async def test_complete_required_only(program_and_run, client, auth_headers):
    """All required tasks complete, optionals skipped → 325 pts, no penalty."""
    _prog, tasks, run = program_and_run
    completions = make_completions(tasks)  # default: required tasks done, optionals not

    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-01-01",
        json={"task_completions": completions},
        headers=auth_headers,
    )
    assert resp.status_code == 200, resp.text
    log = resp.json()

    assert log["is_complete"] is True
    assert log["penalty_applied"] == 0
    assert log["summary_points"] == 325  # 100+100+50+75+0


async def test_complete_with_all_optionals(program_and_run, client, auth_headers):
    """All 8 tasks complete → 370 pts (325 required + 10+20+15 optional)."""
    _prog, tasks, run = program_and_run
    completions = make_completions(tasks, overrides={
        "Weight":               {"completed": True, "logged_value": 75.0, "logged_unit": "kg"},
        "News/Finance/Podcast": {"completed": True, "selected_option": "news"},
        "Skin care":            {"completed": True},
    })

    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-01-02",
        json={"task_completions": completions},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()

    assert log["is_complete"] is True
    assert log["penalty_applied"] == 0
    assert log["summary_points"] == 370  # 325 + 10 + 20 + 15


async def test_bonus_workout(program_and_run, client, auth_headers):
    """Workout logged at 31min (>=30min = 150% threshold) earns +50 bonus → 375 pts total."""
    _prog, tasks, run = program_and_run
    completions = make_completions(tasks, overrides={
        "Workout": {"completed": True, "logged_value": 31, "logged_unit": "min"},
    })

    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-01-03",
        json={"task_completions": completions},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()

    assert log["is_complete"] is True
    assert log["summary_points"] == 375  # 150(workout with bonus)+100(sugar)+50(water)+75(study)

    # Verify workout task_completion has bonus_earned=True
    workout_tc = next(tc for tc in log["task_completions"] if tc["points_earned"] == 150)
    assert workout_tc["bonus_earned"] is True
    assert workout_tc["points_earned"] == 150


async def test_get_log_returns_existing(program_and_run, client, auth_headers):
    """GET /logs/{date} returns the previously saved log."""
    _prog, tasks, run = program_and_run
    completions = make_completions(tasks)

    await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-01-04",
        json={"task_completions": completions},
        headers=auth_headers,
    )

    resp = await client.get(
        f"/api/v1/user-programs/{run['id']}/logs/2026-01-04",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()
    assert log["is_complete"] is True
    assert log["date"] == "2026-01-04"
