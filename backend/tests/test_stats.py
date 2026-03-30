from unittest.mock import MagicMock
from datetime import date, datetime
import pytest
from app.models.user_program import UserProgram
from app.models.daily_log import DailyLog, TaskCompletion


def _make_up():
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={"tasks": [], "points_per_shield": 1500},
        start_date=date(2026, 1, 1), base_days=75, total_days_required=76,
        current_day=3, failure_count=1, total_points_earned=330,
    )


def _make_log(d: date, complete: bool, points: int):
    return DailyLog(
        user_program_id="up1", date=d,
        is_complete=complete, summary_points=points,
    )


@pytest.fixture
def mock_db(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr("app.routers.stats.get_db", lambda: db)
    return db


def _setup(mock_db):
    up = _make_up()
    up_doc = MagicMock()
    up_doc.exists = True
    up_doc.to_dict.return_value = up.model_dump(mode="json")
    mock_db.collection.return_value.document.return_value.get.return_value = up_doc

    logs = [
        _make_log(date(2026, 1, 1), True, 330),
        _make_log(date(2026, 1, 2), True, 330),
        _make_log(date(2026, 1, 3), False, 0),
    ]
    log_docs = []
    for l in logs:
        d = MagicMock()
        d.to_dict.return_value = l.model_dump(mode="json")
        log_docs.append(d)
    mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = log_docs
    return up


async def test_summary(client, auth_headers, mock_db):
    _setup(mock_db)
    resp = await client.get("/api/v1/user-programs/up1/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["complete_days"] == 2
    assert data["compliance_pct"] == 66.7
    assert data["failure_count"] == 1


async def test_streaks(client, auth_headers, mock_db):
    _setup(mock_db)
    resp = await client.get("/api/v1/user-programs/up1/stats/streaks", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_streak"] == 0
    assert data["best_streak"] == 2


async def test_heatmap(client, auth_headers, mock_db):
    _setup(mock_db)
    resp = await client.get("/api/v1/user-programs/up1/stats/heatmap", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3
