# ── Firebase project ──────────────────────────────────────────────────────────

resource "google_firebase_project" "default" {
  provider = google
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

# Enable Firebase Auth
resource "google_identity_platform_config" "auth" {
  project = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }
  }

  depends_on = [google_firebase_project.default]
}
