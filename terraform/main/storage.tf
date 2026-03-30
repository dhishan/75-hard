# ── Evidence bucket ───────────────────────────────────────────────────────────

resource "google_storage_bucket" "evidence" {
  project                     = var.project_id
  name                        = "75hard-${var.environment}-evidence"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = var.environment == "dev" ? true : false

  cors {
    origin          = [var.frontend_origin]
    method          = ["GET", "PUT", "DELETE", "OPTIONS"]
    response_header = ["Content-Type", "Authorization"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "backend_evidence_admin" {
  bucket = google_storage_bucket.evidence.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}
