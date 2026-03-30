import os
import firebase_admin
from firebase_admin import credentials, firestore

_app = None


def _init_app():
    global _app
    if _app is not None:
        return
    if os.getenv("FIRESTORE_EMULATOR_HOST"):
        import firebase_admin.credentials as fb_creds
        from google.oauth2.credentials import Credentials as GoogleCredentials

        class _EmulatorCredential(fb_creds.Base):
            def get_credential(self):
                cred = GoogleCredentials(token="owner")
                cred.expiry = None
                return cred

        _app = firebase_admin.initialize_app(
            _EmulatorCredential(),
            options={"projectId": os.getenv("GCP_PROJECT_ID", "demo-75hard")},
        )
    else:
        cred = credentials.ApplicationDefault()
        _app = firebase_admin.initialize_app(cred)


def get_db():
    _init_app()
    return firestore.client()
