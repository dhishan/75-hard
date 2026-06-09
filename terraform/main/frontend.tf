# ── Frontend domain locals ────────────────────────────────────────────────────
#
# The GCS bucket + HTTPS LB + managed cert + static IP were removed in favour
# of Firebase Hosting (see firebase_hosting.tf). Firebase Hosting is free for
# any realistic traffic volume and eliminates the ~$20/mo forwarding-rule idle
# cost.

locals {
  frontend_domain = "75hard.${var.root_domain}"
  backend_domain  = "api.75hard.${var.root_domain}"
}
