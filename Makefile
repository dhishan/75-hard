# ── Terraform ─────────────────────────────────────────────────────────────────
TF_DIR     := terraform/main
TF_ENV     ?= dev
WORKSPACE  := terraform/workspaces/$(TF_ENV)
REGION     ?= us-central1

.PHONY: terraform-init terraform-plan terraform-apply terraform-destroy push-backend

terraform-init:
	cd $(TF_DIR) && terraform init \
	  -backend-config=../workspaces/$(TF_ENV)/backend.conf \
	  -reconfigure

terraform-plan:
	cd $(TF_DIR) && terraform plan \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

terraform-apply:
	cd $(TF_DIR) && terraform apply \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

terraform-destroy:
	cd $(TF_DIR) && terraform destroy \
	  -var-file=../workspaces/$(TF_ENV)/terraform.tfvars

push-backend:
	docker build -t $(shell cd $(TF_DIR) && terraform output -raw artifact_registry_repo)/backend:latest ./backend
	docker push $(shell cd $(TF_DIR) && terraform output -raw artifact_registry_repo)/backend:latest
