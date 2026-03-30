import os
import pytest
from httpx import AsyncClient, ASGITransport

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
