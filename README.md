# 75 Hard Challenge Tracker

A full-stack web application to track your [75 Hard](https://andyfrisella.com/pages/75hard-info) challenge — daily tasks, progress photos, workout logs, and streaks.

## Architecture

```
75-hard/
├── backend/          # Python/FastAPI REST API → Cloud Run
├── frontend/         # React/TypeScript SPA → Cloud Storage + HTTPS LB
├── terraform/        # GCP infrastructure (Terraform)
├── .github/workflows # CI/CD and infra deployment pipelines
├── Makefile          # Developer workflow orchestration
└── docker-compose.yml
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 · FastAPI · Firestore |
| Frontend | React 18 · TypeScript · Vite · Tailwind CSS |
| Infrastructure | GCP Cloud Run · Cloud Storage · HTTPS LB · Firestore |
| IaC | Terraform (remote state in GCS) |
| CI/CD | GitHub Actions |

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
- [Terraform >= 1.0](https://developer.hashicorp.com/terraform/downloads)
- Docker (optional, for containerised dev)

### 1 · First-time GCP setup

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

make setup PROJECT_ID=YOUR_PROJECT_ID
```

### 2 · Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp terraform/workspaces/dev/terraform.tfvars.example \
   terraform/workspaces/dev/terraform.tfvars
# Edit each file with your values
```

### 3 · Provision infrastructure

```bash
make terraform-apply TF_ENV=dev PROJECT_ID=YOUR_PROJECT_ID
```

### 4 · Start local development

```bash
make install   # install Python venv + npm packages
make dev       # start backend (port 8000) and frontend (port 5173)
```

Or with Docker Compose:

```bash
make docker-dev   # hot-reload for both services
```

## Makefile Targets

| Target | Description |
|---|---|
| `make help` | List all targets |
| `make install` | Install all dependencies |
| `make dev` | Start backend + frontend in dev mode |
| `make test` | Run backend tests |
| `make lint` | Lint backend and frontend |
| `make build-backend` | Build backend Docker image |
| `make build-frontend` | Build frontend for production |
| `make deploy` | Deploy backend + frontend to GCP |
| `make terraform-plan` | Preview infra changes |
| `make terraform-apply` | Apply infra changes |
| `make status` | Show deployment status |

## CI/CD

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-cd.yml` | Push / PR to `main` | Test, build, and deploy app |
| `infra-deploy.yml` | Changes to `terraform/**` | Plan / apply / destroy infra |

### Required GitHub Secrets

| Secret | Description |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT` | GCP service account email used by CI |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |

### Required GitHub Variables

| Variable | Description |
|---|---|
| `GCP_PROJECT_ID` | GCP project ID (e.g. `my-project-123`) |
| `BACKEND_API_URL` | Deployed backend API URL (e.g. `https://api.example.com`) |

## Sub-project READMEs

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)
- [terraform/README.md](terraform/README.md)
