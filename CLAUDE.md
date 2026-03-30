# 75 Hard — Project Context

## GCP Infrastructure

**Project:** `personal-projects-473219`
**Region:** `us-central1`
**Firestore location:** `nam5` (multi-region US)

### Shared resources (used across all personal projects)
- **Terraform state bucket:** `dhishan-terraform-assets` — prefix per project, e.g. `75hard/prod/state`
- **CI service account:** `tf-github@personal-projects-473219.iam.gserviceaccount.com`
- **WIF pool:** `projects/610355955735/locations/global/workloadIdentityPools/github-pool`
- **WIF provider:** stored as `GCP_WORKLOAD_IDENTITY_PROVIDER` GitHub secret
- **Domain:** `blueelephants.org` (managed in Cloudflare, verified in Google Search Console under `dhishan.coder@gmail.com`)
- **Cloudflare zone ID:** `1eb0ae8907a74b14d5226384b92946b7`

### This project's resources
- **Artifact Registry:** `us-central1-docker.pkg.dev/personal-projects-473219/seventy5hard-backend`
- **Cloud Run:** `seventy5hard-backend-prod` → `https://seventy5hard-backend-prod-ix5fldbdya-uc.a.run.app`
- **Frontend bucket:** `seventy5hard-prod-frontend`
- **Evidence bucket:** `seventy5hard-prod-evidence`
- **Backend SA:** `seventy5hard-prod@personal-projects-473219.iam.gserviceaccount.com`
- **Frontend URL:** `https://75hard.blueelephants.org`
- **Backend URL:** `https://api.75hard.blueelephants.org`

### Naming constraint
GCP resource names cannot start with digits. Use `seventy5hard-` prefix for GCP resource names; `75hard` is fine for DNS subdomains and bucket names where allowed.

## GitHub Actions

**CI/CD** (`.github/workflows/ci-cd.yml`): triggers on push to `main`
- Backend tests + frontend build in parallel
- On success: `terraform init` → docker build+push → `terraform apply` → frontend build → `gsutil deploy`

**E2E** (`.github/workflows/e2e.yml`): triggers after CI/CD succeeds on main (or manual dispatch)
- Backend integration tests against Firebase emulator
- Playwright E2E (full stack: emulator + uvicorn + vite preview)

**Infra deploy** (`.github/workflows/infra-deploy.yml`): manual only

### Required GitHub secrets
```
GCP_WORKLOAD_IDENTITY_PROVIDER  # WIF provider resource name
GCP_SERVICE_ACCOUNT             # tf-github@personal-projects-473219.iam.gserviceaccount.com
CLOUDFLARE_API_TOKEN            # Zone-level edit permissions on blueelephants.org
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
```

## Terraform

**Structure:**
```
terraform/
  main/           # all .tf files
  workspaces/
    prod/
      backend.conf      # bucket + prefix (committed — no secrets)
      terraform.tfvars  # committed — secrets passed via TF_VAR_ env vars
```

**Init:** `make terraform-init TF_ENV=prod`
**Apply:** `make terraform-apply TF_ENV=prod` (requires `TF_VAR_cloudflare_api_token`)

Providers: `google ~> 5.0`, `google-beta ~> 5.0` (required for Firebase resources), `cloudflare ~> 4.0`

**Cloud Run domain mapping** requires `tf-github` SA to be a verified owner of `blueelephants.org` — it is, verified via family-expense-tracker precedent.

## Local Development

```bash
docker compose up   # starts: firebase emulator, backend (uvicorn), frontend (vite dev)
```

Firebase emulator: auth on `:9099`, Firestore on `:8080`, UI on `:4000`
Backend: `:8000`, Frontend: `:5173`

## Firebase

**Project ID (prod):** `personal-projects-473219`
**Firebase Admin SDK** initialized in backend via `firebase-admin` with ADC
**Auth emulator** binding: `0.0.0.0` (set in `firebase.json`) for Docker compatibility

## Playwright E2E

- Build frontend with `VITE_E2E=true` to expose `window.__e2eSignIn` helper
- Use `[class*="bg-green-100"]` / `[class*="bg-red-100"]` for save banner selectors (not `bg-green` which matches task cards)
- After clicking sub-option buttons, wait for `toHaveClass(/bg-blue-600/)` before saving

## New Project Checklist

When creating a new personal project with this same stack:

1. Add `dhishan/<repo>` to `tf-github` WIF bindings:
   ```
   gcloud iam service-accounts add-iam-policy-binding tf-github@personal-projects-473219.iam.gserviceaccount.com \
     --member="principalSet://iam.googleapis.com/projects/610355955735/locations/global/workloadIdentityPools/github-pool/attribute.repository/dhishan/<repo>" \
     --role="roles/iam.workloadIdentityUser"
   ```
2. Set GitHub secrets (copy from another repo, update VITE_FIREBASE_* values)
3. Create Terraform backend.conf pointing to `dhishan-terraform-assets` with a unique prefix
4. GCP resource names: must start with a letter — use a spelled-out prefix
5. Terraform state: `dhishan-terraform-assets/<project>/prod/state`
