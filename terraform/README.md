# Terraform

Infrastructure-as-code for the 75 Hard Challenge Tracker, targeting Google Cloud Platform.

## Structure

```
terraform/
├── main/                          # Root Terraform module
│   ├── provider.tf                # GCS backend + Google provider
│   ├── main.tf                    # All GCP resources
│   ├── variables.tf               # Input variable declarations
│   └── outputs.tf                 # Output values
└── workspaces/
    └── dev/
        ├── backend.conf           # GCS backend config (bucket/prefix)
        └── terraform.tfvars.example  # Variable values template
```

## Resources Provisioned

| Resource | Purpose |
|---|---|
| Cloud Run | Backend API container |
| Artifact Registry | Backend Docker images |
| Firestore | Application database |
| Cloud Storage | Frontend static assets |
| HTTPS Load Balancer | Serves frontend with CDN |
| Secret Manager | JWT secret key |
| IAM service account | Least-privilege backend identity |

## Prerequisites

1. [Terraform >= 1.0](https://developer.hashicorp.com/terraform/downloads)
2. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) authenticated (`gcloud auth application-default login`)
3. A GCS bucket for Terraform state – create one with `make setup-tfstate-bucket`

## First-time Setup

```bash
# 1. Create the Terraform state bucket (once per project)
make setup-tfstate-bucket PROJECT_ID=your-project-id

# 2. Copy the example vars file and fill in your values
cp terraform/workspaces/dev/terraform.tfvars.example \
   terraform/workspaces/dev/terraform.tfvars

# 3. Initialise Terraform
make terraform-init TF_ENV=dev

# 4. Preview the changes
make terraform-plan TF_ENV=dev

# 5. Apply
make terraform-apply TF_ENV=dev
```

## Adding a New Environment

```bash
cp -r terraform/workspaces/dev terraform/workspaces/prod
# Edit terraform/workspaces/prod/backend.conf and terraform.tfvars
make terraform-apply TF_ENV=prod
```
