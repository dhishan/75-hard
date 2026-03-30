from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "local"
    gcp_project_id: str = "demo-75hard"
    gcs_bucket_evidence: str = "demo-evidence"
    firestore_emulator_host: str = ""
    firebase_auth_emulator_host: str = ""
    storage_emulator_host: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
