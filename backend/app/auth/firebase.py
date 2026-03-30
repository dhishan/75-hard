import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import firebase_admin.auth as fb_auth
from app.db.firestore import _init_app

security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials

    # Allow test bypass in local/test env
    if os.getenv("ENV") in ("local", "test") and token.startswith("test-uid-"):
        return {"uid": token.removeprefix("test-uid-"), "email": "test@example.com"}

    _init_app()
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
