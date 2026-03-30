# ── Cloud Run — Backend ───────────────────────────────────────────────────────

resource "google_cloud_run_service" "backend" {
  project  = var.project_id
  name     = "seventy5hard-backend-${var.environment}"
  location = var.region

  template {
    spec {
      service_account_name = google_service_account.backend.email

      containers {
        image = var.backend_image

        ports {
          container_port = 8000
        }

        env {
          name  = "ENV"
          value = "prod"
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCS_BUCKET_EVIDENCE"
          value = "seventy5hard-${var.environment}-evidence"
        }

        env {
          name  = "FRONTEND_ORIGIN"
          value = var.frontend_origin
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  lifecycle {
    ignore_changes = [
      template[0].metadata[0].annotations["run.googleapis.com/operation-id"],
    ]
  }

  depends_on = [google_project_service.apis]
}

# ── Public access ─────────────────────────────────────────────────────────────


resource "google_cloud_run_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  service  = google_cloud_run_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Cloud Run domain mapping ──────────────────────────────────────────────────

resource "google_cloud_run_domain_mapping" "backend" {
  project  = var.project_id
  name     = "api.75hard.${var.root_domain}"
  location = var.region

  spec {
    route_name = google_cloud_run_service.backend.name
  }

  metadata {
    namespace = var.project_id
  }

  depends_on = [google_cloud_run_service.backend]
}
