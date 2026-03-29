output "backend_url" {
  description = "Auto-assigned Cloud Run URL of the backend service"
  value       = google_cloud_run_service.backend.status[0].url
}

output "frontend_bucket_name" {
  description = "GCS bucket hosting the frontend static assets"
  value       = google_storage_bucket.frontend.name
}

output "frontend_load_balancer_ip" {
  description = "Global IP address of the HTTPS Load Balancer serving the frontend"
  value       = google_compute_global_address.frontend.address
}

output "firestore_database" {
  description = "Firestore database name"
  value       = google_firestore_database.database.name
}

output "backend_service_account_email" {
  description = "Email of the backend Cloud Run service account"
  value       = google_service_account.backend_sa.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository URL for backend Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "jwt_secret_id" {
  description = "Secret Manager secret ID for the JWT signing key"
  value       = google_secret_manager_secret.jwt_secret.secret_id
}
