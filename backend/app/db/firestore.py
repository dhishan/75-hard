import os
import firebase_admin
from firebase_admin import credentials, firestore

_app = None


def _init_app():
    global _app
    if _app is not None:
        return
    if os.getenv("FIRESTORE_EMULATOR_HOST"):
        _app = firebase_admin.initialize_app(
            options={"projectId": os.getenv("GCP_PROJECT_ID", "demo-75hard")}
        )
    else:
        cred = credentials.ApplicationDefault()
        _app = firebase_admin.initialize_app(cred)


def get_db():
    _init_app()
    return firestore.client()
