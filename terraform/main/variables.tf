variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, prod)"
  type        = string
  default     = "dev"
}

variable "app_name" {
  description = "Short application name used to prefix resources"
  type        = string
  default     = "75-hard"
}

variable "backend_service_name" {
  description = "Cloud Run service name for the backend"
  type        = string
  default     = "75-hard-backend"
}

variable "frontend_bucket_name" {
  description = "GCS bucket name for the frontend static assets"
  type        = string
}

variable "firestore_location" {
  description = "Firestore database location"
  type        = string
  default     = "us-central1"
}

variable "google_client_id" {
  description = "Google OAuth Client ID used to validate Google Sign-In tokens"
  type        = string
  default     = ""
}

variable "frontend_domain" {
  description = "Custom domain for the frontend (e.g. app.example.com)"
  type        = string
  default     = ""
}

variable "backend_domain" {
  description = "Custom domain for the backend API (e.g. api.example.com)"
  type        = string
  default     = ""
}
