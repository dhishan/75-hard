import os
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, patch

os.environ["ENV"] = "test"

from app.main import app  # noqa: E402


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-uid-user123"}


@pytest.fixture
def mock_db():
    with patch("app.db.firestore.get_db") as mock:
        yield mock.return_value
