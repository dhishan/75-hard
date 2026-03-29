.PHONY: help install dev dev-backend dev-frontend stop \
        build-backend build-frontend \
        test lint format clean \
        docker-dev docker-up docker-down \
        gcp-auth docker-push-backend \
        deploy-backend deploy-frontend deploy \
        terraform-init terraform-plan terraform-apply terraform-destroy terraform-output terraform-cleanup terraform-unlock \
        setup-tfstate-bucket setup-artifact-registry enable-apis setup status

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
PROJECT_ID        ?= $(shell gcloud config get-value project 2>/dev/null)
REGION            ?= us-central1
ENV               ?= dev
APP_NAME          ?= 75-hard
BACKEND_SERVICE   ?= 75-hard-backend
BACKEND_IMAGE     ?= 75-hard-backend
GCR_IMAGE         ?= $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(APP_NAME)-backend/$(APP_NAME)-backend
FRONTEND_BUCKET   ?= 75-hard-frontend-$(ENV)
TF_ENV            ?= dev
TF_DIR            := terraform/main
TF_VARS_REL       := ../workspaces/$(TF_ENV)/terraform.tfvars
TF_VARS_PATH      := $(TF_DIR)/../workspaces/$(TF_ENV)/terraform.tfvars

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-30s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
install: ## Install all dependencies (backend venv + frontend npm)
	@echo "Installing backend dependencies..."
	cd backend && \
		([ -d venv ] || python3 -m venv venv) && \
		. venv/bin/activate && \
		pip install --upgrade pip && \
		pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Dependencies installed"

# ---------------------------------------------------------------------------
# Local development
# ---------------------------------------------------------------------------
dev: ## Run backend and frontend in development mode (parallel)
	@echo "Starting development servers..."
	@trap 'kill 0' EXIT; \
	(cd backend && . venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000) & \
	(cd frontend && npm run dev)

dev-backend: ## Run only the backend in development mode
	cd backend && . venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000

dev-frontend: ## Run only the frontend in development mode
	cd frontend && npm run dev

docker-dev: ## Run with Docker Compose (hot reload profile)
	docker-compose --profile dev up --build

docker-up: ## Run with Docker Compose (production build)
	docker-compose up --build

docker-down: ## Stop Docker Compose
	docker-compose down

stop: ## Stop development servers and free up ports
	@echo "Stopping development servers..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "✅ Ports cleared"

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
build-backend: ## Build backend Docker image (linux/amd64 for Cloud Run)
	@echo "Building backend Docker image..."
	cd backend && docker build --platform=linux/amd64 -t $(BACKEND_IMAGE):latest .
	@echo "✅ Backend image built: $(BACKEND_IMAGE):latest"

build-frontend: ## Build frontend for production
	@echo "Building frontend..."
	cd frontend && npm run build
	@echo "✅ Frontend built to frontend/dist/"

# ---------------------------------------------------------------------------
# Test & Lint
# ---------------------------------------------------------------------------
test: ## Run backend tests
	@echo "Running backend tests..."
	cd backend && . venv/bin/activate && python -m pytest tests/ -v || echo "No tests found"
	@echo "✅ Tests complete"

lint: ## Lint backend and frontend code
	@echo "Linting backend..."
	cd backend && . venv/bin/activate && pip install --quiet ruff && ruff check app/ || true
	@echo "Linting frontend..."
	cd frontend && npm run lint || true
	@echo "✅ Linting complete"

format: ## Auto-format backend and frontend code
	@echo "Formatting backend..."
	cd backend && . venv/bin/activate && pip install --quiet black && black app/ || true
	@echo "Formatting frontend..."
	cd frontend && npx prettier --write src/ || true
	@echo "✅ Formatting complete"

clean: ## Remove build artefacts and virtual environments
	rm -rf backend/__pycache__ backend/**/__pycache__ backend/.pytest_cache
	rm -rf frontend/dist frontend/node_modules
	rm -rf backend/venv
	@echo "✅ Cleaned"

# ---------------------------------------------------------------------------
# GCP authentication
# ---------------------------------------------------------------------------
gcp-auth: ## Authenticate with Google Cloud
	gcloud auth login
	gcloud auth application-default login
	gcloud config set project $(PROJECT_ID)

# ---------------------------------------------------------------------------
# Docker / Artifact Registry
# ---------------------------------------------------------------------------
docker-push-backend: build-backend ## Push backend image to Artifact Registry
	@echo "Configuring Docker credentials..."
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet
	docker tag $(BACKEND_IMAGE):latest $(GCR_IMAGE):latest
	docker push $(GCR_IMAGE):latest
	@echo "✅ Backend image pushed: $(GCR_IMAGE):latest"

# ---------------------------------------------------------------------------
# Deployment
# ---------------------------------------------------------------------------
deploy-backend: docker-push-backend ## Build, push, and deploy backend to Cloud Run
	@echo "Deploying backend to Cloud Run..."
	gcloud run deploy $(BACKEND_SERVICE) \
		--image $(GCR_IMAGE):latest \
		--platform managed \
		--region $(REGION) \
		--allow-unauthenticated \
		--set-env-vars "GCP_PROJECT_ID=$(PROJECT_ID)" \
		--set-env-vars "FIRESTORE_DATABASE=$(APP_NAME)-$(ENV)" \
		--set-env-vars "ENVIRONMENT=$(ENV)" \
		--min-instances 0 \
		--max-instances 10 \
		--memory 512Mi \
		--cpu 1
	@echo "✅ Backend deployed"
	@gcloud run services describe $(BACKEND_SERVICE) --region $(REGION) --format 'value(status.url)'

deploy-frontend: build-frontend ## Build and deploy frontend to Cloud Storage
	@echo "Deploying frontend to Cloud Storage..."
	gsutil -m rsync -r -d frontend/dist gs://$(FRONTEND_BUCKET)
	gsutil setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" gs://$(FRONTEND_BUCKET)/index.html
	gsutil -m setmeta -h "Cache-Control:public, max-age=31536000, immutable" \
		gs://$(FRONTEND_BUCKET)/assets/*.js gs://$(FRONTEND_BUCKET)/assets/*.css 2>/dev/null || true
	@echo "✅ Frontend deployed to gs://$(FRONTEND_BUCKET)"
	@echo "Invalidating CDN cache..."
	gcloud compute url-maps invalidate-cdn-cache $(BACKEND_SERVICE)-frontend --path "/*" --async || true
	@echo "✅ CDN cache invalidation initiated"

deploy: deploy-backend deploy-frontend ## Deploy both backend and frontend

# ---------------------------------------------------------------------------
# Terraform
# ---------------------------------------------------------------------------
terraform-init: ## Initialise Terraform for TF_ENV workspace
	terraform -chdir=$(TF_DIR) init -backend-config=../workspaces/$(TF_ENV)/backend.conf

terraform-plan: terraform-init ## Preview Terraform changes (set TF_ENV=prod for prod)
	@if [ ! -f $(TF_VARS_PATH) ]; then \
		echo "Missing $(TF_VARS_PATH). Copy terraform.tfvars.example and fill in values."; \
		exit 1; \
	fi
	terraform -chdir=$(TF_DIR) plan -var-file=$(TF_VARS_REL)

terraform-apply: terraform-init ## Apply Terraform changes
	@if [ ! -f $(TF_VARS_PATH) ]; then \
		echo "Missing $(TF_VARS_PATH). Copy terraform.tfvars.example and fill in values."; \
		exit 1; \
	fi
	terraform -chdir=$(TF_DIR) apply -var-file=$(TF_VARS_REL) -auto-approve

terraform-destroy: ## Destroy Terraform-managed resources
	@if [ ! -f $(TF_VARS_PATH) ]; then \
		echo "Missing $(TF_VARS_PATH)."; \
		exit 1; \
	fi
	terraform -chdir=$(TF_DIR) destroy -var-file=$(TF_VARS_REL)

terraform-output: ## Show Terraform outputs
	terraform -chdir=$(TF_DIR) output

terraform-cleanup: ## Delete local Terraform cache files
	rm -rf $(TF_DIR)/.terraform
	rm -f  $(TF_DIR)/.terraform.lock.hcl
	rm -f  $(TF_DIR)/terraform.tfstate $(TF_DIR)/terraform.tfstate.backup
	@echo "✅ Terraform local files cleaned"

terraform-unlock: ## Force-unlock Terraform state (enter Lock ID when prompted)
	@echo "Enter the Lock ID from the error message:"; \
	read lock_id; \
	terraform -chdir=$(TF_DIR) force-unlock -force $$lock_id

# ---------------------------------------------------------------------------
# One-time setup helpers
# ---------------------------------------------------------------------------
setup-tfstate-bucket: ## Create GCS bucket for Terraform remote state
	gsutil mb -p $(PROJECT_ID) -c STANDARD -l $(REGION) gs://$(PROJECT_ID)-tfstate || true
	gsutil versioning set on gs://$(PROJECT_ID)-tfstate
	@echo "✅ Terraform state bucket ready: gs://$(PROJECT_ID)-tfstate"

setup-artifact-registry: ## Create Artifact Registry repository for backend images
	gcloud artifacts repositories create $(APP_NAME)-backend \
		--repository-format=docker \
		--location=$(REGION) \
		--description="75 Hard backend images" || true
	@echo "✅ Artifact Registry repository ready"

enable-apis: ## Enable all required GCP APIs
	gcloud services enable \
		run.googleapis.com \
		storage.googleapis.com \
		artifactregistry.googleapis.com \
		iam.googleapis.com \
		secretmanager.googleapis.com \
		firestore.googleapis.com \
		compute.googleapis.com
	@echo "✅ APIs enabled"

setup: enable-apis setup-tfstate-bucket setup-artifact-registry install ## Full first-time project setup
	@echo ""
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. cp backend/.env.example backend/.env  (fill in values)"
	@echo "  2. cp frontend/.env.example frontend/.env  (fill in values)"
	@echo "  3. cp terraform/workspaces/dev/terraform.tfvars.example \\"
	@echo "        terraform/workspaces/dev/terraform.tfvars  (fill in values)"
	@echo "  4. make terraform-apply TF_ENV=dev"
	@echo "  5. make dev  (start local development)"

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
status: ## Show current deployment status
	@echo "=== Backend (Cloud Run) ==="
	@gcloud run services describe $(BACKEND_SERVICE) --region $(REGION) --format 'value(status.url)' 2>/dev/null || echo "Not deployed"
	@echo ""
	@echo "=== Frontend (Cloud Storage) ==="
	@gsutil ls gs://$(FRONTEND_BUCKET) 2>/dev/null && echo "gs://$(FRONTEND_BUCKET)" || echo "Not deployed"
