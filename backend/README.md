# Backend

Python/FastAPI backend for the 75 Hard Challenge Tracker.

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Runtime**: Python 3.11
- **Database**: Google Cloud Firestore
- **Auth**: Google OAuth + JWT
- **Container**: Docker (Cloud Run)

## Folder Structure

```
backend/
├── app/
│   ├── auth/        # Authentication logic (Google OAuth, JWT)
│   ├── models/      # Pydantic data models
│   ├── routers/     # FastAPI route handlers
│   ├── services/    # Business logic / Firestore access
│   ├── utils/       # Shared helpers
│   ├── config.py    # Settings loaded from env vars
│   └── main.py      # FastAPI app entry point
├── tests/           # pytest test suite
├── .env.example     # Environment variable template
├── Dockerfile       # Production image (Cloud Run)
├── Dockerfile.local # Development image (hot reload)
└── requirements.txt # Python dependencies
```

## Local Development

```bash
# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your values

# Run the development server
uvicorn app.main:app --reload --port 8000
```

API docs are available at http://localhost:8000/docs once the server is running.

## Running Tests

```bash
source venv/bin/activate
pytest tests/ -v
```

## Docker

```bash
# Production build
docker build -t 75-hard-backend .

# Local development with hot reload
docker build -f Dockerfile.local -t 75-hard-backend-local .
docker run -p 8000:8000 --env-file .env 75-hard-backend-local
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GCP_PROJECT_ID` | GCP project ID | `your-gcp-project-id` |
| `FIRESTORE_DATABASE` | Firestore database name | `75-hard-dev` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | |
| `ENVIRONMENT` | `development` / `production` | `development` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:5173` |
| `JWT_SECRET_KEY` | Secret for signing JWTs | **must be set in prod** |
