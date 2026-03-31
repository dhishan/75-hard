from unittest.mock import MagicMock
from datetime import date, datetime
import pytest
from app.models.user_program import UserProgram
from app.models.program import TaskDefinition, TaskType
from app.models.daily_log import DailyLog, TaskCompletion


def _make_up(failure_count=0, shield_tokens=0):
    task_snap = {
        "id": "t1", "program_id": "p1", "name": "Workout", "category": "fitness",
        "type": "duration", "target_value": 20, "is_required": True,
        "completion_points": 100, "bonus_points": 50, "bonus_threshold_pct": 1.5,
        "min_completion_pct": 1.0, "times_per_day": 1, "order": 0,
        "sub_options": [], "tags": [], "evidence_types": [],
        "evidence_required": False, "created_at": datetime.utcnow().isoformat(),
        "unit": "min", "frequency": "daily",
    }
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={"tasks": [task_snap], "points_per_shield": 1500, "penalty_mode": "exponential"},
        start_date=date.today(), base_days=75, total_days_required=75,
        failure_count=failure_count, shield_tokens_available=shield_tokens,
    )


def _make_up_with_frequency(frequency="daily", failure_count=0, shield_tokens=0):
    task_snap = {
        "id": "t1", "program_id": "p1", "name": "Workout", "category": "fitness",
        "type": "duration", "target_value": 20, "is_required": True,
        "completion_points": 0, "bonus_points": 0, "bonus_threshold_pct": 1.0,
        "min_completion_pct": 1.0, "times_per_day": 1, "order": 0,
        "sub_options": [], "tags": [], "evidence_types": [],
        "evidence_required": False, "created_at": datetime.utcnow().isoformat(),
        "unit": "min", "frequency": frequency,
    }
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={
            "tasks": [task_snap],
            "points_per_shield": 1500,
            "penalty_mode": "exponential",
        },
        start_date=date(2026, 1, 1), base_days=75, total_days_required=75,
        failure_count=failure_count, shield_tokens_available=shield_tokens,
    )


@pytest.fixture
def mock_db(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr("app.routers.daily_logs.get_db", lambda: db)
    return db


def _setup_up_mock(mock_db, up):
    up_doc = MagicMock()
    up_doc.exists = True
    up_doc.to_dict.return_value = up.model_dump(mode="json")
    mock_db.collection.return_value.document.return_value.get.return_value = up_doc


async def test_upsert_complete_day(client, auth_headers, mock_db):
    up = _make_up()
    _setup_up_mock(mock_db, up)
    mock_db.collection.return_value.document.return_value.set.return_value = None
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value.exists = False
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set.return_value = None

    resp = await client.put(
        f"/api/v1/user-programs/up1/logs/{date.today()}",
        json={"task_completions": [{"task_id": "t1", "completed": True, "logged_value": 25, "bonus_earned": False, "points_earned": 0, "evidence": []}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is True
    assert data["penalty_applied"] == 0
    assert data["summary_points"] == 0  # required task earns 0 points


async def test_upsert_incomplete_day_applies_penalty(client, auth_headers, mock_db):
    up = _make_up()
    _setup_up_mock(mock_db, up)
    mock_db.collection.return_value.document.return_value.set.return_value = None
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.set.return_value = None

    resp = await client.put(
        f"/api/v1/user-programs/up1/logs/{date.today()}",
        json={"task_completions": [{"task_id": "t1", "completed": False, "bonus_earned": False, "points_earned": 0, "evidence": []}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is False
    assert data["penalty_applied"] == 1  # first failure: 2^0 = 1


async def test_weekly_task_not_penalized_if_done_earlier_this_week(client, auth_headers, mock_db):
    """A required weekly task completed earlier this week should not trigger penalty."""
    from app.models.daily_log import DailyLog as DL, TaskCompletion as TC
    from unittest.mock import MagicMock

    up = _make_up_with_frequency(frequency="weekly")
    _setup_up_mock(mock_db, up)

    earlier_log = DL(
        user_program_id="up1", date=date(2026, 1, 5),
        is_complete=True, task_completions=[
            TC(task_id="t1", completed=True, logged_value=25,
               points_earned=0, bonus_earned=False, evidence=[])
        ], summary_points=0,
    )
    earlier_doc = MagicMock()
    earlier_doc.to_dict.return_value = earlier_log.model_dump(mode="json")

    (mock_db.collection.return_value.document.return_value
     .collection.return_value.where.return_value.where.return_value
     .stream.return_value) = [earlier_doc]
    (mock_db.collection.return_value.document.return_value
     .collection.return_value.document.return_value.get.return_value.exists) = False
    (mock_db.collection.return_value.document.return_value
     .collection.return_value.document.return_value.set.return_value) = None

    log_date = date(2026, 1, 7)
    resp = await client.put(
        f"/api/v1/user-programs/up1/logs/{log_date}",
        json={"task_completions": [{
            "task_id": "t1", "completed": False,
            "bonus_earned": False, "points_earned": 0, "evidence": []
        }]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_complete"] is True
    assert data["penalty_applied"] == 0
