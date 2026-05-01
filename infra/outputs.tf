output "backend_url" {
  description = "Backend Cloud Run service URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "Frontend Cloud Run service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "artifact_registry" {
  description = "Artifact Registry base path — use as the docker tag/push prefix"
  value       = "${local.registry_host}/${var.project_id}/${local.repo_name}"
}

output "ci_service_account_email" {
  description = "Set this as GCP_SERVICE_ACCOUNT in GitHub repository secrets"
  value       = google_service_account.ci.email
}

output "workload_identity_provider" {
  description = "Set this as GCP_WORKLOAD_IDENTITY_PROVIDER in GitHub repository secrets"
  value       = google_iam_workload_identity_pool_provider.github.name
}
