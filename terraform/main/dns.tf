# ── Cloudflare DNS ────────────────────────────────────────────────────────────

# Frontend — CNAME to Firebase Hosting (replaces A record to GCP LB).
# Firebase Hosting provisions a managed SSL cert for 75hard.blueelephants.org
# once this CNAME is in place.
resource "cloudflare_record" "frontend_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "75hard"
  type    = "CNAME"
  content = "${google_firebase_hosting_site.frontend.site_id}.web.app"
  proxied = false
  ttl     = 300
}

# Backend — CNAME to Cloud Run domain mapping endpoint
resource "cloudflare_record" "backend_cname" {
  zone_id = var.cloudflare_zone_id
  name    = "api.75hard"
  type    = "CNAME"
  content = "ghs.googlehosted.com"
  proxied = false
  ttl     = 300
}
