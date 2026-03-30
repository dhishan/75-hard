variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (dev or prod)"
  type        = string

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be 'dev' or 'prod'."
  }
}

variable "backend_image" {
  description = "Full Docker image path for the backend (e.g. us-central1-docker.pkg.dev/project/repo/backend:latest)"
  type        = string
}

variable "firestore_location" {
  description = "Firestore multi-region location"
  type        = string
  default     = "nam5"
}

variable "frontend_origin" {
  description = "Frontend origin URL allowed in CORS (e.g. https://75hard.app)"
  type        = string
}
