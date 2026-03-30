from unittest.mock import MagicMock, patch
from datetime import date, datetime
import pytest
from app.models.user_program import UserProgram
from app.models.program import Program


def _make_up(uid="user123"):
    return UserProgram(
        id="up1",
        user_uid=uid,
        program_id="prog1",
        program_snapshot={},
        start_date=date.today(),
        base_days=75,
        total_days_required=75,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_db(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr("app.routers.user_programs.get_db", lambda: db)
    return db


async def test_start_program(client, auth_headers, mock_db):
    prog = Program(
        id="prog1", owner_uid="user123", name="P",
        created_at=datetime.utcnow(), updated_at=datetime.utcnow()
    )
    prog_doc = MagicMock()
    prog_doc.exists = True
    prog_doc.to_dict.return_value = prog.model_dump(mode="json")
    mock_db.collection.return_value.document.return_value.get.return_value = prog_doc
    mock_db.collection.return_value.document.return_value.collection.return_value.stream.return_value = []
    mock_db.collection.return_value.document.return_value.set.return_value = None

    resp = await client.post(
        "/api/v1/user-programs",
        json={"program_id": "prog1", "start_date": str(date.today())},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["program_id"] == "prog1"
    assert resp.json()["status"] == "active"


async def test_list_user_programs(client, auth_headers, mock_db):
    up = _make_up()
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = up.model_dump(mode="json")
    mock_db.collection.return_value.where.return_value.stream.return_value = [mock_doc]
    resp = await client.get("/api/v1/user-programs", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
