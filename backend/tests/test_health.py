from app.auth.firebase import verify_token


async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_verify_token_test_bypass():
    class FakeCreds:
        credentials = "test-uid-abc123"

    result = await verify_token(FakeCreds())
    assert result["uid"] == "abc123"
    assert result["email"] == "test@example.com"
