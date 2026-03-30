# ── APIs ──────────────────────────────────────────────────────────────────────

locals {
  required_apis = [
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
    "storage.googleapis.com",
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
  ]

  evidence_bucket_name = "75hard-${var.environment}-evidence"
  app_name             = "75hard-${var.environment}"
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
}

# ── Artifact Registry ─────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "backend" {
  project       = var.project_id
  location      = var.region
  repository_id = "75hard-backend"
  description   = "Docker images for 75 Hard backend"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# ── Firestore ─────────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.firestore_location
  type                        = "FIRESTORE_NATIVE"
  delete_protection_state     = "DELETE_PROTECTION_ENABLED"
  deletion_policy             = "ABANDON"

  depends_on = [google_project_service.apis]
}

# ── Service Account ───────────────────────────────────────────────────────────

resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = local.app_name
  display_name = "75 Hard Backend (${var.environment})"

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "backend_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# Needed for v4 signed URLs — SA must be able to sign blobs as itself
resource "google_service_account_iam_member" "backend_token_creator" {
  service_account_id = google_service_account.backend.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "backend_firebase_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.viewer"
  member  = "serviceAccount:${google_service_account.backend.email}"
}
