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

variable "cloudflare_api_token" {
  description = "Cloudflare API token for DNS management"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for blueelephants.org"
  type        = string
  default     = "1eb0ae8907a74b14d5226384b92946b7"
}

variable "root_domain" {
  description = "Root domain"
  type        = string
  default     = "blueelephants.org"
}

variable "google_oauth_client_secret" {
  description = "Google OAuth client secret for Firebase Auth Google sign-in"
  type        = string
  sensitive   = true
}

variable "frontend_bucket_name" {
  description = "GCS bucket name for frontend static hosting"
  type        = string
}
