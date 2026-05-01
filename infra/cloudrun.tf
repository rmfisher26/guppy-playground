# ── Backend ───────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "backend" {
  name                = "guppy-playground-backend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account                  = google_service_account.cloudrun.email
    max_instance_request_concurrency = 10

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.backend_image

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          memory = "1024Mi"
          cpu    = "1"
        }
        cpu_idle = true
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }
      env {
        name  = "COMPILE_TIMEOUT_SECONDS"
        value = var.compile_timeout_seconds
      }
      env {
        name  = "SIMULATE_TIMEOUT_SECONDS"
        value = var.simulate_timeout_seconds
      }
      env {
        name  = "MAX_SHOTS"
        value = var.max_shots
      }
      env {
        name  = "SANDBOX_MEMORY_MB"
        value = var.sandbox_memory_mb
      }
      env {
        name  = "MAX_CODE_LENGTH"
        value = var.max_code_length
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }
    }
  }

  # CI/CD owns image updates after initial creation — Terraform manages
  # everything else (env vars, scaling, resources).
  # If this path raises an error on your Terraform version, broaden to:
  #   ignore_changes = [template]
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = google_cloud_run_v2_service.backend.project
  location = google_cloud_run_v2_service.backend.location
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Frontend ──────────────────────────────────────────────────────────────────
# Prerequisite: a frontend/Dockerfile that builds the Astro static site and
# serves it via nginx. Once it exists, build and push before the first apply:
#
#   docker build --build-arg PUBLIC_API_URL=BACKEND_URL -t REGISTRY/guppy-playground/frontend:latest ./frontend
#   docker push REGISTRY/guppy-playground/frontend:latest

resource "google_cloud_run_v2_service" "frontend" {
  name                = "guppy-playground-frontend"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.frontend_image

      resources {
        limits = {
          memory = "256Mi"
          cpu    = "1"
        }
        cpu_idle = true
      }

    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = google_cloud_run_v2_service.frontend.project
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Custom domain mappings ─────────────────────────────────────────────────────
# Prerequisite: verify domain ownership at https://search.google.com/search-console
# before mappings will activate. Google provisions TLS automatically.

resource "google_cloud_run_domain_mapping" "backend" {
  location = var.region
  name     = "${var.backend_subdomain}.${var.domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.backend.name
  }
}

resource "google_cloud_run_domain_mapping" "frontend" {
  location = var.region
  name     = "${var.frontend_subdomain}.${var.domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }
}
