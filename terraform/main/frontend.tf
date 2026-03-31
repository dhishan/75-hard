# ── Frontend static site — GCS + HTTPS LB ────────────────────────────────────

locals {
  frontend_domain = "75hard.${var.root_domain}"
  backend_domain  = "api.75hard.${var.root_domain}"
}

resource "google_storage_bucket" "frontend" {
  project       = var.project_id
  name          = var.frontend_bucket_name
  location      = var.region
  force_destroy = var.environment == "dev" ? true : false
  storage_class = "STANDARD"

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  uniform_bucket_level_access = true
  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ── HTTPS Load Balancer ───────────────────────────────────────────────────────

resource "google_compute_global_address" "frontend" {
  project = var.project_id
  name    = "seventy5hard-frontend-ip-${var.environment}"
}

resource "google_compute_backend_bucket" "frontend" {
  project     = var.project_id
  name        = "seventy5hard-frontend-backend-${var.environment}"
  bucket_name = google_storage_bucket.frontend.name
  enable_cdn  = true
}

resource "google_compute_url_map" "frontend" {
  project         = var.project_id
  name            = "seventy5hard-frontend-url-map-${var.environment}"
  default_service = google_compute_backend_bucket.frontend.id

  # Serve index.html for 404s — required for SPA client-side routing.
  # url_rewrite does not work with backend buckets; custom_error_response_policy does.
  default_custom_error_response_policy {
    error_response_rule {
      match_response_codes   = ["404"]
      path                   = "/index.html"
      override_response_code = 200
    }
    error_service = google_compute_backend_bucket.frontend.id
  }
}

resource "google_compute_managed_ssl_certificate" "frontend" {
  project = var.project_id
  name    = "seventy5hard-frontend-cert-${var.environment}"

  managed {
    domains = [local.frontend_domain]
  }
}

resource "google_compute_target_https_proxy" "frontend" {
  project          = var.project_id
  name             = "seventy5hard-frontend-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.frontend.id
  ssl_certificates = [google_compute_managed_ssl_certificate.frontend.id]
}

resource "google_compute_global_forwarding_rule" "frontend" {
  project    = var.project_id
  name       = "seventy5hard-frontend-forwarding-rule-${var.environment}"
  target     = google_compute_target_https_proxy.frontend.id
  port_range = "443"
  ip_address = google_compute_global_address.frontend.address
}
