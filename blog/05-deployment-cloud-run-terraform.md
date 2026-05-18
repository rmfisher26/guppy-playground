# Deploying Guppy Playground: Cloud Run, Cloudflare, and Terraform

*Posted on guppyfisher.dev*

---

The playground runs at [pond.guppyfisher.dev](https://pond.guppyfisher.dev). This post covers exactly how it gets there: the infrastructure choices, the CI/CD pipelines, and what's actually running in production.

## The High-Level Split

Both the frontend and backend run as containers on Google Cloud Run. There's no CDN or separate static host — the frontend is served by an nginx container on Cloud Run alongside the FastAPI backend container.

| Part | Where it lives |
|------|---------------|
| Frontend (nginx + static build) | Google Cloud Run |
| Backend (FastAPI API) | Google Cloud Run |

Cloudflare manages DNS for both services — `pond.guppyfisher.dev` and `api.guppyfisher.dev` are CNAME records pointing at the Cloud Run domain mappings. The records are set to DNS-only (not proxied), so traffic goes directly to Cloud Run without going through Cloudflare's CDN layer.

---

## Frontend: Cloud Run (nginx container)

On every push to `main` that touches `frontend/`, a GitHub Actions workflow builds a Docker image (nginx serving the Astro static build), pushes it to Artifact Registry, and deploys it to Cloud Run.

```yaml
# .github/workflows/deploy-frontend.yml (simplified)
- name: Build and push image
  run: |
    IMAGE=$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/frontend:$GITHUB_SHA
    docker build \
      --build-arg PUBLIC_API_URL=${{ secrets.BACKEND_URL }} \
      -t $IMAGE \
      ./frontend
    docker push $IMAGE

- name: Deploy to Cloud Run
  run: |
    gcloud run deploy guppy-playground-frontend \
      --image $IMAGE \
      --region $REGION \
      --platform managed
```

The `PUBLIC_API_URL` build arg is injected at image build time so the compiled frontend bundle knows where to send API requests — it's baked into the JS, not resolved at runtime.

---

## Backend: Google Cloud Run

The backend is a Docker container built from `backend/Dockerfile` and deployed to Cloud Run. Cloud Run is serverless in the sense that you specify CPU and memory limits, a container image, and Google manages the rest — scaling, routing, health checks.

The CI/CD pipeline:

```yaml
# .github/workflows/deploy-backend.yml (simplified)
- name: Build and push image
  run: |
    gcloud auth configure-docker $REGION-docker.pkg.dev
    docker build -t $IMAGE_TAG ./backend
    docker push $IMAGE_TAG

- name: Deploy to Cloud Run
  run: |
    gcloud run deploy guppy-playground-backend \
      --image $IMAGE_TAG \
      --region $REGION \
      --platform managed \
      --memory 2Gi
```

The 2 GB memory allocation gives the container room for the Python process, uvicorn workers, and the subprocess overhead from numpy/OpenBLAS imports (covered in the [architecture post](./04-under-the-hood-architecture.md)).

Cloud Run scales to zero when there's no traffic. The first request after a cold start takes a few extra seconds while the container boots — acceptable for a playground, not acceptable for a latency-sensitive API.

---

## Infrastructure as Code: Terraform

The GCP resources (Artifact Registry, Cloud Run service, IAM bindings, service account) are defined in Terraform under `infra/`. This means the entire infrastructure is reproducible from a `terraform apply`.

The key resources:

```hcl
# infra/cloudrun.tf (simplified)
resource "google_cloud_run_v2_service" "backend" {
  name     = "guppy-playground-backend"
  location = var.region

  template {
    containers {
      image = var.backend_image
      resources {
        limits = { memory = "1024Mi", cpu = "1" }
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
  }
}
```

Cloudflare DNS records are also managed via Terraform using the Cloudflare provider, so there's one place (the `infra/` directory) that describes the full production topology.

---

## Secrets and Environment Variables

Production secrets (GCP credentials, Cloudflare API token) live in GitHub Actions secrets and are injected at deploy time. The backend reads its configuration from environment variables via Pydantic Settings:

```python
class Settings(BaseSettings):
    allowed_origins: str = '["http://localhost:4321","https://guppyfisher.dev"]'
```

The CORS allowlist includes both the production domain and localhost so the frontend can talk to a local backend during development without any config changes.

---

## The Full Request Path in Production

1. Browser loads `pond.guppyfisher.dev` → Cloudflare DNS resolves to Cloud Run → nginx serves the static bundle
2. User writes code, hits `Ctrl+Enter`
3. Frontend sends `POST https://api.guppyfisher.dev/run` → Cloud Run
4. Cloud Run routes to the FastAPI container
5. FastAPI validates the request, spawns a subprocess
6. Subprocess compiles + simulates, writes JSON to stdout
7. FastAPI reads the result, responds with 200 JSON
8. Frontend renders the histogram, HUGR tab, and any errors

The backend URL (`PUBLIC_API_URL`) is baked into the frontend build as an Astro environment variable, so the frontend always knows where to send requests.

---

## What I'd Change

Cloud Run's cold start is the one rough edge. If you hit the playground after a quiet period, the first run takes noticeably longer. The fix is a minimum instance count of 1 in Cloud Run, which keeps one container warm at all times — at the cost of a small always-on charge.

For a hobby project I've left it at zero and accepted the cold starts. For anything user-facing in a production product, I'd set `min-instances: 1`.

---

That wraps up the five-post series on Guppy Playground. If you have questions or want to contribute, the source is at [github.com/rmfisher26/guppy-playground](https://github.com/rmfisher26/guppy-playground) and the playground itself is always at [pond.guppyfisher.dev](https://pond.guppyfisher.dev).
