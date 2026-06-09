# Firebase Hosting for the React frontend.
#
# Replaces the GCS bucket + global HTTPS LB + managed cert + static IP stack.
# That stack costs ~$20/month at idle just to keep the forwarding rule alive.
# Firebase Hosting gives identical functionality (custom domain, free SSL,
# global CDN) on the free tier for any volume this app will ever see.

resource "google_project_service" "firebasehosting" {
  service                    = "firebasehosting.googleapis.com"
  disable_on_destroy         = false
  disable_dependent_services = false
}

# Named Firebase Hosting site. Site IDs are globally unique across all Firebase
# projects — suffix with -ble to avoid collisions.
resource "google_firebase_hosting_site" "frontend" {
  provider = google-beta
  project  = var.project_id
  site_id  = "seventy5hard-ble"

  depends_on = [
    google_firebase_project.default,
    google_project_service.firebasehosting,
  ]
}

# Register the production hostname as a custom domain on the Firebase site.
# Firebase provisions a managed SSL cert once DNS is flipped to the CNAME.
resource "google_firebase_hosting_custom_domain" "frontend" {
  provider      = google-beta
  project       = var.project_id
  site_id       = google_firebase_hosting_site.frontend.site_id
  custom_domain = "75hard.${var.root_domain}"

  # Cert provisioning is async — don't block terraform apply waiting for it.
  wait_dns_verification = false

  redirect_target = null
}

output "firebase_hosting_default_url" {
  value       = "https://${google_firebase_hosting_site.frontend.site_id}.web.app"
  description = "Default Firebase Hosting URL — verify the build serves here after first deploy."
}

output "firebase_hosting_custom_domain_status" {
  value = {
    domain = google_firebase_hosting_custom_domain.frontend.custom_domain
    note   = "Check Firebase console or API for cert/verification status after DNS cutover."
  }
}

# The CI service account needs Firebase Hosting Admin to publish releases.
# roles/editor alone is not sufficient for hosting.releases.create.
resource "google_project_iam_member" "ci_firebase_hosting_admin" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:tf-github@${var.project_id}.iam.gserviceaccount.com"

  depends_on = [google_project_service.firebasehosting]
}
