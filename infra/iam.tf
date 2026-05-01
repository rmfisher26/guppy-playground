# ── Workload Identity Federation ──────────────────────────────────────────────
# Lets GitHub Actions obtain short-lived GCP credentials without storing
# a service account key in GitHub Secrets.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider-v2"
  display_name                       = "GitHub OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Restricts token exchange to this repo only.
  # To lock down further to main branch only, append:
  #   && assertion.ref == 'refs/heads/main'
  attribute_condition = "assertion.repository == '${var.github_org}/${var.github_repo}'"
}

# ── CI/CD service account (impersonated by GitHub Actions) ────────────────────

resource "google_service_account" "ci" {
  account_id   = "github-actions-ci"
  display_name = "GitHub Actions CI/CD"
  depends_on   = [google_project_service.apis]
}

# Allow WIF tokens from this repo to impersonate the CI SA
resource "google_service_account_iam_member" "wif_ci" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_org}/${var.github_repo}"
}

resource "google_project_iam_member" "ci_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_project_iam_member" "ci_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.ci.email}"
}

# CI SA must be able to act-as the runtime SA when deploying a new revision
resource "google_service_account_iam_member" "ci_act_as_run" {
  service_account_id = google_service_account.cloudrun.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}

# ── Cloud Run runtime service account ─────────────────────────────────────────
# Runs with minimal permissions. Add project IAM bindings here if the services
# ever need to call other GCP APIs (e.g. Secret Manager, Firestore).

resource "google_service_account" "cloudrun" {
  account_id   = "cloudrun-runtime"
  display_name = "Cloud Run Runtime"
  depends_on   = [google_project_service.apis]
}
