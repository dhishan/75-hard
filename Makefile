# ── Terraform ─────────────────────────────────────────────────────────────────
TF_DIR     := terraform/main
TF_ENV     ?= dev
WORKSPACE  := terraform/workspaces/$(TF_ENV)
REGION     ?= us-central1

.PHONY: terraform-init terraform-plan terraform-apply terraform-destroy push-backend deploy-frontend

terraform-init:
	cd $(TF_DIR) && terraform init \
	  -backend-config=../workspaces/$(TF_ENV)/backend.conf \
	  -reconfigure

terraform-plan:
	cd $(TF_DIR) && terraform plan \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

terraform-apply:
	cd $(TF_DIR) && terraform apply -auto-approve \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

terraform-destroy:
	cd $(TF_DIR) && terraform destroy \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

IMAGE_REPO ?= us-central1-docker.pkg.dev/personal-projects-473219/seventy5hard-backend

push-backend:
	docker build --platform linux/amd64 -t $(IMAGE_REPO)/backend:latest ./backend
	docker push $(IMAGE_REPO)/backend:latest

local-reset:
	docker compose down -v
	docker volume rm 75-hard_emulator-data 2>/dev/null || true

deploy-frontend:
	gsutil -m rsync -r -d frontend/dist gs://$(shell cd $(TF_DIR) && terraform output -raw frontend_bucket_name 2>/dev/null || echo "seventy5hard-$(TF_ENV)-frontend")
	gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" "gs://$(shell cd $(TF_DIR) && terraform output -raw frontend_bucket_name 2>/dev/null || echo "seventy5hard-$(TF_ENV)-frontend")/assets/**"
	gsutil setmeta -h "Cache-Control:no-cache, no-store" "gs://$(shell cd $(TF_DIR) && terraform output -raw frontend_bucket_name 2>/dev/null || echo "seventy5hard-$(TF_ENV)-frontend")/index.html"
