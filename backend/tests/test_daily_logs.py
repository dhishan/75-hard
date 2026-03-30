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
        "unit": "min",
    }
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={"tasks": [task_snap], "points_per_shield": 1500},
        start_date=date.today(), base_days=75, total_days_required=75,
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
    assert data["summary_points"] == 100  # completion_points


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
