"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # GCP Configuration
    gcp_project_id: str = "your-gcp-project-id"
    firestore_database: str = "75-hard-dev"

    # Google OAuth
    google_client_id: str = ""

    # Application Settings
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 1 week

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
