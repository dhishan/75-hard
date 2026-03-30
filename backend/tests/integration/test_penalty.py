"""
Scenarios:
  1. Incomplete day → +1 day penalty (failure #1: 2^0=1)
  2. Second incomplete day → +2 day penalty (failure #2: 2^1=2)
  3. Third → +4 days (2^2=4)
  4. UserProgram.total_days_required correctly accumulates
  5. UserProgram.failure_count correctly increments
"""
import pytest
from datetime import date
from tests.integration.conftest import create_sample_program, start_run, make_completions

pytestmark = pytest.mark.asyncio


@pytest.fixture
async def program_and_run(client, auth_headers, created_program_ids, created_up_ids, cleanup):
    data = await create_sample_program(client, auth_headers)
    created_program_ids.append(data["program"]["id"])
    run = await start_run(client, auth_headers, data["program"]["id"], date(2026, 2, 1))
    created_up_ids.append(run["id"])
    yield data["program"], data["tasks"], run


async def test_first_failure_adds_1_day(program_and_run, client, auth_headers):
    """Missing one required task → failure #1 → +1 day."""
    _prog, tasks, run = program_and_run
    # Miss: No added sugar (required)
    completions = make_completions(tasks, overrides={
        "No added sugar": {"completed": False},
    })

    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-02-01",
        json={"task_completions": completions},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()
    assert log["is_complete"] is False
    assert log["penalty_applied"] == 1

    # Verify UserProgram state updated
    up_resp = await client.get(
        f"/api/v1/user-programs/{run['id']}", headers=auth_headers
    )
    up = up_resp.json()
    assert up["failure_count"] == 1
    assert up["total_days_required"] == 76  # 75 + 1


async def test_second_failure_adds_2_days(program_and_run, client, auth_headers):
    """Failure #1 (+1) then failure #2 (+2) → total_days_required = 78."""
    _prog, tasks, run = program_and_run

    # Failure 1: miss sugar
    await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-02-01",
        json={"task_completions": make_completions(tasks, overrides={"No added sugar": {"completed": False}})},
        headers=auth_headers,
    )

    # Failure 2: miss workout
    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-02-02",
        json={"task_completions": make_completions(tasks, overrides={"Workout": {"completed": False, "logged_value": 10}})},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()
    assert log["penalty_applied"] == 2

    up_resp = await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)
    up = up_resp.json()
    assert up["failure_count"] == 2
    assert up["total_days_required"] == 78  # 75 + 1 + 2


async def test_third_failure_adds_4_days(program_and_run, client, auth_headers):
    """Three failures: +1, +2, +4 → total = 82."""
    _prog, tasks, run = program_and_run

    for day, missed_task in [
        ("2026-02-01", {"No added sugar": {"completed": False}}),
        ("2026-02-02", {"Workout": {"completed": False, "logged_value": 5}}),
        ("2026-02-03", {"Water": {"completed": False, "logged_value": 1.0}}),
    ]:
        resp = await client.put(
            f"/api/v1/user-programs/{run['id']}/logs/{day}",
            json={"task_completions": make_completions(tasks, overrides=missed_task)},
            headers=auth_headers,
        )
        assert resp.status_code == 200

    up_resp = await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)
    up = up_resp.json()
    assert up["failure_count"] == 3
    assert up["total_days_required"] == 82  # 75+1+2+4


async def test_complete_day_after_failure_no_extra_penalty(program_and_run, client, auth_headers):
    """A complete day after a failure doesn't add penalty and doesn't change failure_count."""
    _prog, tasks, run = program_and_run

    # Fail day 1
    await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-02-01",
        json={"task_completions": make_completions(tasks, overrides={"No added sugar": {"completed": False}})},
        headers=auth_headers,
    )

    # Complete day 2
    resp = await client.put(
        f"/api/v1/user-programs/{run['id']}/logs/2026-02-02",
        json={"task_completions": make_completions(tasks)},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    log = resp.json()
    assert log["is_complete"] is True
    assert log["penalty_applied"] == 0

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["failure_count"] == 1  # unchanged
    assert up["total_days_required"] == 76  # unchanged
