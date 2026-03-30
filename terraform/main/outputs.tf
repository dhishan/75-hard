output "backend_url" {
  description = "Cloud Run backend service URL"
  value       = google_cloud_run_service.backend.status[0].url
}

output "evidence_bucket_name" {
  description = "GCS bucket name for evidence photos"
  value       = google_storage_bucket.evidence.name
}

output "backend_sa_email" {
  description = "Service account email used by the backend Cloud Run service"
  value       = google_service_account.backend.email
}

output "artifact_registry_repo" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.backend.repository_id}"
}

output "frontend_ip" {
  description = "Global IP address for the frontend HTTPS load balancer"
  value       = google_compute_global_address.frontend.address
}

output "frontend_url" {
  description = "Frontend URL"
  value       = "https://75hard.${var.root_domain}"
}

output "backend_url_custom" {
  description = "Backend custom domain URL"
  value       = "https://api.75hard.${var.root_domain}"
}

output "frontend_bucket_name" {
  description = "GCS bucket name for frontend static hosting"
  value       = google_storage_bucket.frontend.name
}
