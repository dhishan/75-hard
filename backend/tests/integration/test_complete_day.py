"""
Scenarios:
  1. Required-only perfect day → 0 pts (required tasks never earn points), no penalty
  2. All tasks (required + optionals) → 45 pts (10+20+15 from optional tasks)
  3. Workout logged at 31min — required task, still earns 0 pts; day is complete
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
    """All required tasks complete, optionals skipped → 0 pts (required tasks don't earn points), no penalty."""
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
    assert log["summary_points"] == 0  # required tasks earn 0 points


async def test_complete_with_all_optionals(program_and_run, client, auth_headers):
    """All 8 tasks complete → 45 pts (0 required + 10+20+15 optional)."""
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
    assert log["summary_points"] == 45  # 0 required + 10+20+15 optional


async def test_workout_required_no_points(program_and_run, client, auth_headers):
    """Workout at 31min (above threshold) — required task earns 0 pts even with bonus config."""
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
    assert log["summary_points"] == 0  # required task — no points regardless of value

    # All task completions earn 0 pts (all required)
    assert all(tc["points_earned"] == 0 for tc in log["task_completions"])
    assert all(tc["bonus_earned"] is False for tc in log["task_completions"])


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
