# Integration & E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** End-to-end test coverage of the 75 Hard challenge tracker — backend integration tests against the real Firestore emulator, and Playwright browser tests for full UI user journeys — using the Sample 75 Hard program (8 tasks from the spec image).

**Architecture:** Backend integration tests run via `pytest` with `ASGITransport` (in-process FastAPI) + real Firestore emulator (must be running via `docker compose up firebase`). Playwright tests run against `npm run dev` + `uvicorn` locally, authenticate via the Firebase Auth emulator's REST sign-up API, and inject the token into browser localStorage. Both suites create all data they need and clean up completely via DELETE endpoints after each test.

**Tech Stack:** pytest / pytest-asyncio / httpx — Playwright 1.43 / TypeScript — Firebase Auth emulator REST API — Docker Compose (Firebase + fake-gcs)

**Sample Program (used in all tests):**
```
Task 1: No added sugar      boolean     required    100 pts
Task 2: Workout (20min)     duration    required    100 pts  bonus +50 at 150% (30min)
Task 3: Water               measurement required     50 pts  target 3 ltr
Task 4: Study session       duration    required     75 pts  target 20 min
Task 5: Alcohol budget      budget      required      0 pts  total_budget 10
Task 6: Weight              measurement optional      10 pts
Task 7: News/Finance/Podcast boolean   optional      20 pts  sub_options [news,finance,podcast]
Task 8: Skin care           boolean     optional      15 pts
```

**Max points/day:** required only = 325 pts | all tasks = 370 pts | bonus day = 395 pts (30+ min workout)

**Shield math (points_per_shield=1500):** 5 perfect required-days → 1625 pts → 1 shield

---

## File Map

```
backend/
├── app/routers/
│   ├── user_programs.py            # MODIFY: add DELETE /{up_id}
│   └── daily_logs.py               # MODIFY: add DELETE /{up_id}/logs/{date}
└── tests/
    └── integration/
        ├── conftest.py             # CREATE: real Firestore client, test UID, sample program factory, cleanup
        ├── test_complete_day.py    # CREATE: complete day scenarios (all required, with optionals, bonus)
        ├── test_penalty.py         # CREATE: penalty escalation scenarios
        └── test_shields.py         # CREATE: earn shields, absorb penalty with shield

playwright/
├── package.json                    # CREATE: playwright + @playwright/test
├── playwright.config.ts            # CREATE: baseURL, projects, globalSetup
├── global-setup.ts                 # CREATE: creates Firebase emulator test user, saves storageState
└── tests/
    ├── create-program.spec.ts      # CREATE: create program + add 8 tasks + start run
    ├── daily-log.spec.ts           # CREATE: complete day, incomplete day, optional tasks
    └── dashboard.spec.ts           # CREATE: dashboard stats after logging
```

---

## Phase A — Backend: Delete Endpoints + Integration Test Infrastructure

---

### Task A1: Add DELETE endpoints for UserProgram and DailyLog

**Files:**
- Modify: `backend/app/routers/user_programs.py`
- Modify: `backend/app/routers/daily_logs.py`

- [ ] **Step 1: Read user_programs.py to see existing structure**

```bash
cat /Users/dhishan/Projects/75-hard/backend/app/routers/user_programs.py
```

- [ ] **Step 2: Add DELETE /{up_id} to user_programs.py**

Append to the end of the router file:
```python
@router.delete("/{up_id}", status_code=204)
async def delete_user_program(up_id: str, user=Depends(verify_token)):
    db = get_db()
    ref = db.collection("userPrograms").document(up_id)
    doc = ref.get()
    if not doc.exists:
        raise HTTPException(404)
    if UserProgram(**doc.to_dict()).user_uid != user["uid"]:
        raise HTTPException(403)
    # Delete all sub-collections (dailyLogs)
    logs = ref.collection("dailyLogs").stream()
    for log in logs:
        log.reference.delete()
    ref.delete()
```

- [ ] **Step 3: Read daily_logs.py to see existing structure**

```bash
cat /Users/dhishan/Projects/75-hard/backend/app/routers/daily_logs.py
```

- [ ] **Step 4: Add DELETE /{up_id}/logs/{log_date} to daily_logs.py**

Append to the end of the router file:
```python
@router.delete("/{up_id}/logs/{log_date}", status_code=204)
async def delete_log(up_id: str, log_date: date, user=Depends(verify_token)):
    db = get_db()
    _get_up_or_403(db, up_id, user["uid"])
    db.collection("userPrograms").document(up_id).collection("dailyLogs").document(str(log_date)).delete()
```

- [ ] **Step 5: Verify existing unit tests still pass**

```bash
cd /Users/dhishan/Projects/75-hard/backend
pytest tests/ -v --tb=short --ignore=tests/integration
```

Expected: 33 passed

- [ ] **Step 6: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add backend/app/routers/user_programs.py backend/app/routers/daily_logs.py
git commit -m "feat: add DELETE endpoints for user_programs and daily_logs"
```

---

### Task A2: Integration Test Conftest

**Files:**
- Create: `backend/tests/integration/__init__.py`
- Create: `backend/tests/integration/conftest.py`

- [ ] **Step 1: Create integration/__init__.py** (empty)

- [ ] **Step 2: Create backend/tests/integration/conftest.py**

```python
"""
Integration test conftest — requires Firebase emulator running.
Start with: docker compose up firebase

All tests use a unique UID per test run to isolate data.
Cleanup is automatic via the `cleanup` fixture.
"""
import os
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import date

# Must be set before importing app modules
os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "localhost:8080")
os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099")
os.environ.setdefault("GCP_PROJECT_ID", "demo-75hard")
os.environ.setdefault("ENV", "test")

from app.main import app  # noqa: E402


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def test_uid():
    """Unique UID per test session so parallel runs don't conflict."""
    return f"integ-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="session")
def auth_headers(test_uid):
    return {"Authorization": f"Bearer test-uid-{test_uid}"}


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
def created_program_ids():
    """Accumulates program IDs created in a test for cleanup."""
    ids = []
    yield ids


@pytest.fixture
def created_up_ids():
    """Accumulates user-program IDs created in a test for cleanup."""
    ids = []
    yield ids


@pytest.fixture
async def cleanup(client, auth_headers, created_program_ids, created_up_ids):
    """Yield, then delete everything created during the test."""
    yield
    for up_id in created_up_ids:
        await client.delete(f"/api/v1/user-programs/{up_id}", headers=auth_headers)
    for prog_id in created_program_ids:
        await client.delete(f"/api/v1/programs/{prog_id}", headers=auth_headers)


# ── Program factory ───────────────────────────────────────────────────────────

SAMPLE_TASKS = [
    {
        "name": "No added sugar",
        "category": "nutrition",
        "type": "boolean",
        "is_required": True,
        "completion_points": 100,
        "bonus_points": 0,
        "order": 1,
    },
    {
        "name": "Workout",
        "category": "fitness",
        "type": "duration",
        "target_value": 20,
        "unit": "min",
        "is_required": True,
        "completion_points": 100,
        "bonus_points": 50,
        "bonus_threshold_pct": 1.5,
        "min_completion_pct": 1.0,
        "order": 2,
    },
    {
        "name": "Water",
        "category": "health",
        "type": "measurement",
        "target_value": 3,
        "unit": "ltr",
        "is_required": True,
        "completion_points": 50,
        "bonus_points": 0,
        "min_completion_pct": 1.0,
        "order": 3,
    },
    {
        "name": "Study session",
        "category": "mindset",
        "type": "duration",
        "target_value": 20,
        "unit": "min",
        "is_required": True,
        "completion_points": 75,
        "bonus_points": 0,
        "min_completion_pct": 1.0,
        "order": 4,
    },
    {
        "name": "Alcohol budget",
        "category": "nutrition",
        "type": "budget",
        "total_budget": 10,
        "unit": "beers",
        "is_required": True,
        "completion_points": 0,
        "bonus_points": 0,
        "order": 5,
    },
    {
        "name": "Weight",
        "category": "health",
        "type": "measurement",
        "unit": "kg",
        "is_required": False,
        "completion_points": 10,
        "bonus_points": 0,
        "order": 6,
    },
    {
        "name": "News/Finance/Podcast",
        "category": "mindset",
        "type": "boolean",
        "is_required": False,
        "completion_points": 20,
        "bonus_points": 0,
        "sub_options": ["news", "finance", "podcast"],
        "order": 7,
    },
    {
        "name": "Skin care",
        "category": "health",
        "type": "boolean",
        "is_required": False,
        "completion_points": 15,
        "bonus_points": 0,
        "order": 8,
    },
]


async def create_sample_program(client, auth_headers) -> dict:
    """Create the sample 75 Hard program with all 8 tasks. Returns {program, tasks}."""
    resp = await client.post(
        "/api/v1/programs",
        json={
            "name": "Sample 75 Hard",
            "duration_days": 75,
            "points_per_shield": 1500,
            "max_shields_per_week": 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    program = resp.json()

    tasks = []
    for task_data in SAMPLE_TASKS:
        tr = await client.post(
            f"/api/v1/programs/{program['id']}/tasks",
            json=task_data,
            headers=auth_headers,
        )
        assert tr.status_code == 201, tr.text
        tasks.append(tr.json())

    return {"program": program, "tasks": tasks}


async def start_run(client, auth_headers, program_id: str, start_date: date) -> dict:
    """Start a user program run."""
    resp = await client.post(
        "/api/v1/user-programs",
        json={"program_id": program_id, "start_date": str(start_date)},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def make_completions(tasks: list[dict], overrides: dict[str, dict] | None = None) -> list[dict]:
    """
    Build a complete-day task_completions list for all 8 tasks.
    Default values represent a perfect required day (all required complete, optionals skipped).
    overrides: {task_name: {field: value}} to customize specific tasks.
    """
    overrides = overrides or {}
    defaults = {
        "No added sugar":         {"completed": True},
        "Workout":                {"completed": True, "logged_value": 25, "logged_unit": "min"},
        "Water":                  {"completed": True, "logged_value": 3.0, "logged_unit": "ltr"},
        "Study session":          {"completed": True, "logged_value": 20, "logged_unit": "min"},
        "Alcohol budget":         {"completed": False, "logged_value": 0},
        "Weight":                 {"completed": False},
        "News/Finance/Podcast":   {"completed": False},
        "Skin care":              {"completed": False},
    }
    for name, patch in overrides.items():
        defaults[name] = {**defaults[name], **patch}

    result = []
    for task in tasks:
        tc = {"task_id": task["id"], "bonus_earned": False, "points_earned": 0, "evidence": []}
        tc.update(defaults.get(task["name"], {"completed": False}))
        result.append(tc)
    return result
```

- [ ] **Step 3: Verify conftest imports without error**

```bash
cd /Users/dhishan/Projects/75-hard/backend
python -c "from tests.integration.conftest import make_completions; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add backend/tests/integration/
git commit -m "test: integration test conftest with sample program factory and cleanup"
```

---

### Task A3: Integration Tests — Complete Day Scenarios

**Files:**
- Create: `backend/tests/integration/test_complete_day.py`

**Prerequisite:** Firebase emulator must be running: `docker compose up firebase -d`

- [ ] **Step 1: Create backend/tests/integration/test_complete_day.py**

```python
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
```

- [ ] **Step 2: Run integration tests (requires emulator running)**

```bash
cd /Users/dhishan/Projects/75-hard
docker compose up firebase -d
sleep 10  # wait for emulator to be ready

cd backend
pytest tests/integration/test_complete_day.py -v
```

Expected:
```
PASSED tests/integration/test_complete_day.py::test_complete_required_only
PASSED tests/integration/test_complete_day.py::test_complete_with_all_optionals
PASSED tests/integration/test_complete_day.py::test_bonus_workout
PASSED tests/integration/test_complete_day.py::test_get_log_returns_existing
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add backend/tests/integration/test_complete_day.py
git commit -m "test(integration): complete day scenarios — required only, optionals, bonus workout"
```

---

### Task A4: Integration Tests — Penalty Escalation

**Files:**
- Create: `backend/tests/integration/test_penalty.py`

- [ ] **Step 1: Create backend/tests/integration/test_penalty.py**

```python
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
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/dhishan/Projects/75-hard/backend
pytest tests/integration/test_penalty.py -v
```

Expected: 4 PASSED

- [ ] **Step 3: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add backend/tests/integration/test_penalty.py
git commit -m "test(integration): penalty escalation — 1/2/4 day sequence and failure_count tracking"
```

---

### Task A5: Integration Tests — Shield Earning and Absorption

**Files:**
- Create: `backend/tests/integration/test_shields.py`

- [ ] **Step 1: Create backend/tests/integration/test_shields.py**

```python
"""
Scenarios:
  1. 5 perfect required-only days (325*5=1625 pts) → shield_tokens_available=1
  2. 6th day failure with shield available → shield absorbed, days unchanged
  3. After shield use: shield_tokens_available=0, shields_used=1, failure_count unchanged
  4. Without enough points, no shield is earned
"""
import pytest
from datetime import date
from tests.integration.conftest import create_sample_program, start_run, make_completions

pytestmark = pytest.mark.asyncio

PERFECT_COMPLETIONS = None  # will be set per test via fixture


@pytest.fixture
async def program_and_run(client, auth_headers, created_program_ids, created_up_ids, cleanup):
    data = await create_sample_program(client, auth_headers)
    created_program_ids.append(data["program"]["id"])
    run = await start_run(client, auth_headers, data["program"]["id"], date(2026, 3, 1))
    created_up_ids.append(run["id"])
    yield data["program"], data["tasks"], run


async def _log_perfect_days(client, auth_headers, up_id: str, tasks: list, dates: list[str]):
    """Log multiple perfect required-only days."""
    for d in dates:
        resp = await client.put(
            f"/api/v1/user-programs/{up_id}/logs/{d}",
            json={"task_completions": make_completions(tasks)},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["is_complete"] is True, f"Day {d} should be complete"


async def test_earn_shield_after_5_perfect_days(program_and_run, client, auth_headers):
    """5 perfect required-only days = 1625 pts → 1 shield token earned."""
    _prog, tasks, run = program_and_run

    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05",
    ])

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_points_earned"] == 1625  # 325 * 5
    assert up["shield_tokens_available"] == 1  # floor(1625/1500) - 0 used = 1


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
    """Only 4 days logged (1300 pts) → no shield yet (need 1500)."""
    _prog, tasks, run = program_and_run

    await _log_perfect_days(client, auth_headers, run["id"], tasks, [
        "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
    ])

    up = (await client.get(f"/api/v1/user-programs/{run['id']}", headers=auth_headers)).json()
    assert up["total_points_earned"] == 1300  # 325 * 4
    assert up["shield_tokens_available"] == 0  # 1300 < 1500


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
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/dhishan/Projects/75-hard/backend
pytest tests/integration/test_shields.py -v
```

Expected: 4 PASSED

- [ ] **Step 3: Run full integration suite**

```bash
pytest tests/integration/ -v
```

Expected: 12 PASSED total

- [ ] **Step 4: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add backend/tests/integration/test_shields.py
git commit -m "test(integration): shield earning and absorption scenarios"
```

---

## Phase B — Playwright E2E Tests

---

### Task B1: Playwright Setup

**Files:**
- Create: `playwright/package.json`
- Create: `playwright/playwright.config.ts`
- Create: `playwright/global-setup.ts`

- [ ] **Step 1: Create playwright directory and package.json**

```bash
mkdir -p /Users/dhishan/Projects/75-hard/playwright/tests
```

```json
{
  "name": "75-hard-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "codegen": "playwright codegen http://localhost:5173"
  },
  "devDependencies": {
    "@playwright/test": "^1.43.0",
    "axios": "^1.6.8"
  }
}
```

- [ ] **Step 2: Install Playwright**

```bash
cd /Users/dhishan/Projects/75-hard/playwright
npm install
npx playwright install chromium
```

Expected: chromium browser installed

- [ ] **Step 3: Create playwright/global-setup.ts**

This creates a Firebase emulator test user and saves the auth state (localStorage) to a file that all tests reuse.

```typescript
import { chromium, FullConfig } from '@playwright/test'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Creates a test user in the Firebase Auth emulator and saves their auth state.
 * The saved state is loaded by tests via storageState so they don't need to sign in.
 *
 * Firebase Auth emulator REST sign-up:
 *   POST http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key
 *   { email, password, returnSecureToken: true }
 * Returns: { idToken, localId, ... }
 */
async function globalSetup(_config: FullConfig) {
  const email = 'e2e-test@75hard.local'
  const password = 'test-password-123'

  // Create user in emulator (idempotent — fails if exists, which is fine)
  try {
    await axios.post(
      'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
      { email, password, returnSecureToken: true },
    )
  } catch {
    // User may already exist from a previous run — that's OK
  }

  // Sign in to get idToken
  const signInResp = await axios.post(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    { email, password, returnSecureToken: true },
  )
  const { idToken, localId } = signInResp.data

  // Build Firebase auth state that matches what the SDK writes to localStorage
  const authState = {
    [`firebase:authUser:demo-key:[DEFAULT]`]: JSON.stringify({
      uid: localId,
      email,
      displayName: 'E2E Test User',
      stsTokenManager: {
        refreshToken: 'fake-refresh-token',
        accessToken: idToken,
        expirationTime: Date.now() + 3600 * 1000,
      },
      lastLoginAt: String(Date.now()),
      createdAt: String(Date.now()),
    }),
  }

  // Save to storage state file
  const storageStatePath = path.join(__dirname, 'auth-state.json')
  fs.writeFileSync(
    storageStatePath,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: Object.entries(authState).map(([name, value]) => ({ name, value })),
        },
      ],
    }),
  )

  console.log(`✓ Firebase test user created: ${email} (uid: ${localId})`)
  console.log(`✓ Auth state saved to ${storageStatePath}`)
}

export default globalSetup
```

- [ ] **Step 4: Create playwright/playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,     // sequential — tests share Firestore state
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  globalSetup: path.resolve(__dirname, './global-setup.ts'),

  use: {
    baseURL: 'http://localhost:5173',
    storageState: path.resolve(__dirname, './auth-state.json'),
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **Step 5: Create playwright/tests/helpers.ts**

This helper creates backend data via the API (bypasses UI for setup steps).

```typescript
import axios from 'axios'

const API = 'http://localhost:8000/api/v1'

/**
 * Get the test user's Firebase ID token from the emulator.
 * Used in API setup calls that need auth.
 */
export async function getTestToken(): Promise<string> {
  const resp = await axios.post(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    { email: 'e2e-test@75hard.local', password: 'test-password-123', returnSecureToken: true },
  )
  return resp.data.idToken
}

export const SAMPLE_TASKS = [
  { name: 'No added sugar', category: 'nutrition', type: 'boolean', is_required: true, completion_points: 100, bonus_points: 0, order: 1 },
  { name: 'Workout', category: 'fitness', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 100, bonus_points: 50, bonus_threshold_pct: 1.5, min_completion_pct: 1.0, order: 2 },
  { name: 'Water', category: 'health', type: 'measurement', target_value: 3, unit: 'ltr', is_required: true, completion_points: 50, bonus_points: 0, min_completion_pct: 1.0, order: 3 },
  { name: 'Study session', category: 'mindset', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 75, bonus_points: 0, min_completion_pct: 1.0, order: 4 },
  { name: 'Alcohol budget', category: 'nutrition', type: 'budget', total_budget: 10, unit: 'beers', is_required: true, completion_points: 0, bonus_points: 0, order: 5 },
  { name: 'Weight', category: 'health', type: 'measurement', unit: 'kg', is_required: false, completion_points: 10, bonus_points: 0, order: 6 },
  { name: 'News/Finance/Podcast', category: 'mindset', type: 'boolean', is_required: false, completion_points: 20, bonus_points: 0, sub_options: ['news', 'finance', 'podcast'], order: 7 },
  { name: 'Skin care', category: 'health', type: 'boolean', is_required: false, completion_points: 15, bonus_points: 0, order: 8 },
]

export async function createSampleProgram(): Promise<{ programId: string; taskMap: Record<string, string> }> {
  const token = await getTestToken()
  const headers = { Authorization: `Bearer ${token}` }

  const prog = await axios.post(`${API}/programs`, {
    name: 'E2E Sample 75 Hard',
    duration_days: 75,
    points_per_shield: 1500,
    max_shields_per_week: 1,
  }, { headers })
  const programId = prog.data.id

  const taskMap: Record<string, string> = {}
  for (const task of SAMPLE_TASKS) {
    const t = await axios.post(`${API}/programs/${programId}/tasks`, task, { headers })
    taskMap[task.name] = t.data.id
  }

  return { programId, taskMap }
}

export async function startRun(programId: string, startDate: string): Promise<string> {
  const token = await getTestToken()
  const resp = await axios.post(`${API}/user-programs`,
    { program_id: programId, start_date: startDate },
    { headers: { Authorization: `Bearer ${token}` } },
  )
  return resp.data.id
}

export async function cleanupRun(upId: string): Promise<void> {
  const token = await getTestToken()
  await axios.delete(`${API}/user-programs/${upId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}

export async function cleanupProgram(programId: string): Promise<void> {
  const token = await getTestToken()
  await axios.delete(`${API}/programs/${programId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {})
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/dhishan/Projects/75-hard/playwright
npx tsc --noEmit --strict --module commonjs --target es2020 --esModuleInterop --resolveJsonModule tests/helpers.ts global-setup.ts playwright.config.ts 2>&1 | head -20
```

Expected: 0 errors (or only minor type warnings)

- [ ] **Step 7: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add playwright/
git commit -m "feat: playwright e2e setup — config, global-setup, auth state, API helpers"
```

---

### Task B2: Playwright — Create Program + Start Run

**Files:**
- Create: `playwright/tests/create-program.spec.ts`

**Prerequisite:** Frontend (`npm run dev`) and backend (`uvicorn app.main:app --port 8000`) must be running.

- [ ] **Step 1: Create playwright/tests/create-program.spec.ts**

```typescript
import { test, expect } from '@playwright/test'
import { cleanupProgram, cleanupRun, createSampleProgram, startRun } from './helpers'

/**
 * Tests that the UI renders the dashboard correctly after a program is created
 * and a run is started via the API (bypassing UI for setup speed).
 *
 * The dashboard should show:
 * - Program name
 * - Day counter (Day 1 / 75)
 * - Shield status (0 available)
 * - "Log Today" button
 */

test.describe('Dashboard — active run', () => {
  let programId: string
  let upId: string

  test.beforeAll(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { programId: pid } = await createSampleProgram()
    programId = pid
    upId = await startRun(programId, today)
  })

  test.afterAll(async () => {
    await cleanupRun(upId)
    await cleanupProgram(programId)
  })

  test('dashboard shows active run details', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Program name should appear
    await expect(page.getByText('E2E Sample 75 Hard')).toBeVisible()

    // Day counter
    await expect(page.getByText(/Day 1/)).toBeVisible()

    // Log Today button
    await expect(page.getByRole('button', { name: 'Log Today' })).toBeVisible()
  })

  test('clicking Log Today navigates to daily log page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Log Today' }).click()
    await page.waitForURL(/\/log\/\d{4}-\d{2}-\d{2}/)

    // Should show task cards
    await expect(page.getByText('No added sugar')).toBeVisible()
    await expect(page.getByText('Workout')).toBeVisible()
    await expect(page.getByText('Water')).toBeVisible()
    await expect(page.getByText('Study session')).toBeVisible()
  })

  test('Graphs page shows 4 chart sections', async ({ page }) => {
    await page.goto('/graphs')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Completion Heatmap')).toBeVisible()
    await expect(page.getByText('Streaks')).toBeVisible()
    await expect(page.getByText('Task Completion Rates')).toBeVisible()
    await expect(page.getByText('Points Accumulation')).toBeVisible()
  })
})
```

- [ ] **Step 2: Start services and run tests**

In separate terminals:
```bash
# Terminal 1: Firebase emulator
docker compose up firebase -d

# Terminal 2: Backend
cd /Users/dhishan/Projects/75-hard/backend
FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 GCP_PROJECT_ID=demo-75hard ENV=local uvicorn app.main:app --port 8000

# Terminal 3: Frontend
cd /Users/dhishan/Projects/75-hard/frontend
npm run dev
```

Run tests:
```bash
cd /Users/dhishan/Projects/75-hard/playwright
npx playwright test tests/create-program.spec.ts --headed
```

Expected: 3 PASSED

- [ ] **Step 3: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add playwright/tests/create-program.spec.ts
git commit -m "test(e2e): dashboard renders active run with day counter and log button"
```

---

### Task B3: Playwright — Daily Log Interactions

**Files:**
- Create: `playwright/tests/daily-log.spec.ts`

- [ ] **Step 1: Create playwright/tests/daily-log.spec.ts**

```typescript
import { test, expect, Page } from '@playwright/test'
import {
  cleanupProgram,
  cleanupRun,
  createSampleProgram,
  startRun,
} from './helpers'

/**
 * Tests the daily log UI:
 *   1. Complete all required tasks → success banner with correct points
 *   2. Skip a required task → penalty banner
 *   3. Complete optional tasks → higher points
 *   4. Saving the same day again updates (idempotent)
 */

const TODAY = new Date().toISOString().split('T')[0]

test.describe('Daily Log', () => {
  let programId: string
  let upId: string

  test.beforeAll(async () => {
    const { programId: pid } = await createSampleProgram()
    programId = pid
    upId = await startRun(programId, TODAY)
  })

  test.afterAll(async () => {
    await cleanupRun(upId)
    await cleanupProgram(programId)
  })

  async function navigateToLog(page: Page) {
    await page.goto(`/log/${TODAY}`)
    await page.waitForLoadState('networkidle')
    // Wait for task cards to render
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })
  }

  test('complete all required tasks shows success banner', async ({ page }) => {
    await navigateToLog(page)

    // Task 1: No added sugar (boolean checkbox)
    await page.getByLabel('').first().check()  // first checkbox = No added sugar
    // More robust: find by proximity to task name
    const sugarCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'No added sugar' })
    await sugarCard.locator('input[type="checkbox"]').check()

    // Task 2: Workout (duration input — enter 25 min)
    const workoutCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' })
    await workoutCard.locator('input[type="number"]').fill('25')

    // Task 3: Water (measurement — 3 ltr)
    const waterCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' })
    await waterCard.locator('input[type="number"]').fill('3')

    // Task 4: Study session (duration — 20 min)
    const studyCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' })
    await studyCard.locator('input[type="number"]').fill('20')

    // Save
    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-green"]', { timeout: 5000 })

    // Success banner
    await expect(page.getByText(/Day complete/)).toBeVisible()
    await expect(page.getByText(/325 pts/)).toBeVisible()
  })

  test('skipping a required task shows penalty banner', async ({ page }) => {
    // Use a different date to avoid conflicts with the complete-day test
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${tomorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Only complete 3 of 4 required tasks (skip "No added sugar")
    const workoutCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' })
    await workoutCard.locator('input[type="number"]').fill('25')

    const waterCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' })
    await waterCard.locator('input[type="number"]').fill('3')

    const studyCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' })
    await studyCard.locator('input[type="number"]').fill('20')

    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-red"]', { timeout: 5000 })

    // Penalty banner
    await expect(page.getByText(/Incomplete/)).toBeVisible()
    await expect(page.getByText(/penalty day/)).toBeVisible()
  })

  test('completing optional tasks adds extra points', async ({ page }) => {
    // Use yet another date
    const overmorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${overmorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Complete all required
    const sugarCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'No added sugar' })
    await sugarCard.locator('input[type="checkbox"]').check()
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' }).locator('input[type="number"]').fill('25')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' }).locator('input[type="number"]').fill('3')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' }).locator('input[type="number"]').fill('20')

    // Complete optionals
    const skinCareCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Skin care' })
    await skinCareCard.locator('input[type="checkbox"]').check()

    const newsCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'News/Finance/Podcast' })
    await newsCard.getByRole('button', { name: 'news' }).click()

    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-green"]', { timeout: 5000 })

    // Should show 325 + 15 + 20 = 360 pts
    await expect(page.getByText(/360 pts/)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/dhishan/Projects/75-hard/playwright
npx playwright test tests/daily-log.spec.ts --headed
```

Expected: 3 PASSED

- [ ] **Step 3: Commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add playwright/tests/daily-log.spec.ts
git commit -m "test(e2e): daily log — complete day, penalty, optional tasks"
```

---

### Task B4: Add npm Scripts + README for Running Tests

**Files:**
- Modify: `playwright/package.json`
- Create: `playwright/README.md`

- [ ] **Step 1: Update playwright/package.json scripts**

```json
{
  "name": "75-hard-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:integration": "cd ../backend && pytest tests/integration/ -v",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.43.0",
    "axios": "^1.6.8"
  }
}
```

- [ ] **Step 2: Verify full Playwright suite runs**

```bash
cd /Users/dhishan/Projects/75-hard/playwright
npx playwright test
```

Expected: All tests pass

- [ ] **Step 3: Verify full backend integration suite**

```bash
cd /Users/dhishan/Projects/75-hard/backend
pytest tests/integration/ -v
```

Expected: 12 PASSED

- [ ] **Step 4: Final commit**

```bash
cd /Users/dhishan/Projects/75-hard
git add playwright/
git commit -m "test: complete e2e and integration test suite for 75 Hard sample program"
```

---

## Test Coverage Matrix

| Scenario | Backend Integration | Playwright E2E |
|---|---|---|
| Create program + 8 tasks | ✅ conftest factory | ✅ helpers.createSampleProgram |
| Complete day (required only) | ✅ test_complete_required_only | ✅ complete all required |
| Complete day + optionals | ✅ test_complete_with_all_optionals | ✅ optional tasks add points |
| Bonus workout (31min) | ✅ test_bonus_workout | — |
| First failure (+1 day) | ✅ test_first_failure_adds_1_day | ✅ skip sugar → penalty banner |
| Penalty escalation (+2, +4) | ✅ test_second/third_failure | — |
| No extra penalty on complete | ✅ test_complete_day_after_failure | — |
| Earn shield (5 days) | ✅ test_earn_shield_after_5_days | — |
| Shield absorbs penalty | ✅ test_shield_absorbs_penalty | — |
| No shield if below threshold | ✅ test_no_shield_when_below | — |
| Unshielded failure after shield | ✅ test_second_failure_after_shield | — |
| Dashboard renders run | — | ✅ create-program.spec |
| Log Today navigates | — | ✅ create-program.spec |
| Graphs page renders | — | ✅ create-program.spec |
| Cleanup (DELETE endpoints) | ✅ cleanup fixture | ✅ afterAll |

## Running Everything

```bash
# 1. Start services
docker compose up firebase -d
cd backend && FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 GCP_PROJECT_ID=demo-75hard ENV=local uvicorn app.main:app --port 8000 &
cd frontend && npm run dev &

# 2. Backend integration tests
cd backend && pytest tests/integration/ -v

# 3. Playwright E2E tests
cd playwright && npx playwright test
```
