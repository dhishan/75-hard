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
