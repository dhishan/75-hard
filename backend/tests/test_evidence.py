from unittest.mock import MagicMock, patch
from datetime import date, datetime
import pytest
from app.models.user_program import UserProgram
from app.models.daily_log import DailyLog, TaskCompletion


def _make_up():
    return UserProgram(
        id="up1", user_uid="user123", program_id="p1",
        program_snapshot={}, start_date=date.today(), base_days=75, total_days_required=75,
    )


@pytest.fixture
def mock_db(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr("app.routers.evidence.get_db", lambda: db)
    return db


async def test_create_evidence_note(client, auth_headers, mock_db):
    up = _make_up()
    up_doc = MagicMock()
    up_doc.exists = True
    up_doc.to_dict.return_value = up.model_dump(mode="json")
    # .collection("userPrograms").document(up_id).get() → up_doc
    mock_db.collection.return_value.document.return_value.get.return_value = up_doc
    # log_ref.get() → does not exist
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value.exists = False

    resp = await client.post(
        f"/api/v1/user-programs/up1/logs/{date.today()}/evidence",
        json={"task_id": "t1", "type": "note", "caption": "Done!"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["evidence"]["type"] == "note"
    assert data["evidence"]["caption"] == "Done!"
    assert data["upload_url"] is None  # notes have no upload URL


async def test_create_photo_evidence_returns_upload_url(client, auth_headers, mock_db):
    up = _make_up()
    up_doc = MagicMock()
    up_doc.exists = True
    up_doc.to_dict.return_value = up.model_dump(mode="json")
    mock_db.collection.return_value.document.return_value.get.return_value = up_doc
    mock_db.collection.return_value.document.return_value.collection.return_value.document.return_value.get.return_value.exists = False

    with patch("app.routers.evidence.generate_upload_url", return_value="http://upload-here"), \
         patch("app.routers.evidence.generate_download_url", return_value="http://view-here"):
        resp = await client.post(
            f"/api/v1/user-programs/up1/logs/{date.today()}/evidence",
            json={"task_id": "t1", "type": "photo", "content_type": "image/jpeg"},
            headers=auth_headers,
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["upload_url"] == "http://upload-here"
    assert data["evidence"]["url"] == "http://view-here"
