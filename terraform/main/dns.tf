# ── Cloudflare DNS ────────────────────────────────────────────────────────────

# Frontend — A record pointing to GCP HTTPS LB
resource "cloudflare_record" "frontend_a" {
  zone_id = var.cloudflare_zone_id
  name    = "75hard"
  type    = "A"
  content = google_compute_global_address.frontend.address
  proxied = false
  ttl     = 300
}

# Backend — CNAME to Cloud Run URL (Cloudflare proxied for SSL)
resource "cloudflare_record" "backend_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "api.75hard"
  type    = "CNAME"
  content = replace(google_cloud_run_service.backend.status[0].url, "https://", "")
  proxied = true
  ttl     = 1
}
