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
