from unittest.mock import MagicMock, patch
from datetime import datetime
import pytest
from app.models.program import Program


def _make_program(uid="user123"):
    return Program(
        id="prog1",
        owner_uid=uid,
        name="Test Program",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


@pytest.fixture
def mock_db():
    db = MagicMock()
    with patch("app.routers.programs.get_db", return_value=db):
        yield db


async def test_create_program(client, auth_headers, mock_db):
    mock_db.collection.return_value.document.return_value.set.return_value = None
    resp = await client.post(
        "/api/v1/programs",
        json={"name": "My Plan", "duration_days": 75, "points_per_shield": 1500},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Plan"
    assert data["owner_uid"] == "user123"


async def test_create_program_requires_auth(client):
    resp = await client.post("/api/v1/programs", json={"name": "x", "duration_days": 75, "points_per_shield": 1500})
    assert resp.status_code == 403


async def test_get_program_not_found(client, auth_headers, mock_db):
    mock_db.collection.return_value.document.return_value.get.return_value.exists = False
    resp = await client.get("/api/v1/programs/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


async def test_list_programs(client, auth_headers, mock_db):
    prog = _make_program()
    mock_doc = MagicMock()
    mock_doc.to_dict.return_value = prog.model_dump(mode="json")
    mock_db.collection.return_value.where.return_value.stream.return_value = [mock_doc]
    resp = await client.get("/api/v1/programs", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["name"] == "Test Program"
