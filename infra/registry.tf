resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = local.repo_name
  description   = "Docker images for guppy-playground"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}
