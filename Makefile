# ── Guppy Playground Makefile ──────────────────────────────────────────────
.PHONY: dev build backend frontend test test-backend test-backend-unit \
        test-backend-routes backend-install install clean \
        robot-install test-robot test-robot-api test-robot-ui \
        tf-apply tf-teardown tf-rebuild tf-wif-restore \
        push-backend push-frontend push-images

VENV    = $(CURDIR)/backend/.venv
PYTHON  = $(VENV)/bin/python
PYTEST  = $(VENV)/bin/pytest
UVICORN = $(VENV)/bin/uvicorn

ROBOT_VENV   = $(CURDIR)/robot/.venv
ROBOT_PYTHON = $(ROBOT_VENV)/bin/python
ROBOT        = $(ROBOT_VENV)/bin/robot

# Create the backend venv + install deps if the venv doesn't exist yet
$(PYTHON):
	uv venv $(VENV)
	uv pip install -r backend/requirements.txt --python $(PYTHON)

# Create the robot venv + install deps if the venv doesn't exist yet
$(ROBOT_PYTHON):
	uv venv $(ROBOT_VENV)
	uv pip install -r robot/requirements.txt --python $(ROBOT_PYTHON)

# ── Infrastructure ─────────────────────────────────────────────────────────
GCP_PROJECT  = guppyfisher
GCP_REGION   = us-central1
REGISTRY     = $(GCP_REGION)-docker.pkg.dev/$(GCP_PROJECT)/guppy-playground
WIF_POOL     = github-pool
WIF_PROVIDER = github-provider-v2

# GCP soft-deletes WIF pools for 30 days — undelete and reimport before apply.
tf-wif-restore:
	@cd infra && \
	  gcloud iam workload-identity-pools undelete $(WIF_POOL) \
	    --location=global --project=$(GCP_PROJECT) --quiet 2>/dev/null || true; \
	  gcloud iam workload-identity-pools providers undelete $(WIF_PROVIDER) \
	    --workload-identity-pool=$(WIF_POOL) \
	    --location=global --project=$(GCP_PROJECT) --quiet 2>/dev/null || true; \
	  terraform import google_iam_workload_identity_pool.github \
	    projects/$(GCP_PROJECT)/locations/global/workloadIdentityPools/$(WIF_POOL) 2>/dev/null || true; \
	  terraform import google_iam_workload_identity_pool_provider.github \
	    projects/$(GCP_PROJECT)/locations/global/workloadIdentityPools/$(WIF_POOL)/providers/$(WIF_PROVIDER) 2>/dev/null || true

tf-apply: tf-wif-restore
	cd infra && terraform apply

tf-teardown:
	cd infra && terraform destroy

# Rebuild in the correct order: registry → backend image → backend service
#   → frontend image (needs backend URL) → everything else.
tf-rebuild:
	$(MAKE) tf-teardown
	$(MAKE) tf-wif-restore
	cd infra && terraform apply -target=google_artifact_registry_repository.images -auto-approve
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	$(MAKE) push-backend
	cd infra && terraform apply \
	  -target=google_cloud_run_v2_service.backend \
	  -target=google_cloud_run_v2_service_iam_member.backend_public \
	  -auto-approve
	$(MAKE) push-frontend
	$(MAKE) tf-apply

push-backend:
	gcloud auth configure-docker $(GCP_REGION)-docker.pkg.dev --quiet
	docker build -t $(REGISTRY)/backend:latest ./backend
	docker push $(REGISTRY)/backend:latest

push-frontend:
	@BACKEND_URL=$$(cd infra && terraform output -raw backend_url) && \
	  docker build \
	    --build-arg PUBLIC_API_URL=$$BACKEND_URL \
	    -t $(REGISTRY)/frontend:latest \
	    ./frontend && \
	  docker push $(REGISTRY)/frontend:latest

push-images: push-backend push-frontend

# ── Full stack ─────────────────────────────────────────────────────────────
dev:
	docker compose up --build

down:
	docker compose down

# ── Frontend ───────────────────────────────────────────────────────────────
install:
	npm install

frontend:
	npm run dev

build:
	npm run build

# ── Backend ────────────────────────────────────────────────────────────────
backend: $(PYTHON)
	cd backend && $(UVICORN) app.main:app --reload --port 8000

backend-install:
	uv venv $(VENV)
	uv pip install -r backend/requirements.txt --python $(PYTHON)

# ── Tests ──────────────────────────────────────────────────────────────────
test-backend: $(PYTHON)
	cd backend && $(PYTEST) tests/ -v

test-backend-unit: $(PYTHON)
	cd backend && $(PYTEST) tests/test_api.py -v

test-backend-routes: $(PYTHON)
	cd backend && $(PYTEST) tests/test_routes.py -v

# Robot Framework acceptance suite — assumes `make dev` / `docker compose up` is already
# running (frontend on :4321, backend on :8000). rfbrowser init fetches the Playwright
# browser binaries the Browser library needs; it's a separate step from pip install
# because a missing browser only fails at test-run time, not install time.
robot-install: $(ROBOT_PYTHON)
	$(ROBOT_VENV)/bin/rfbrowser init

test-robot-api: robot-install
	$(ROBOT) --variable API_URL:http://localhost:8000 \
	         --outputdir robot/results \
	         robot/api/

test-robot-ui: robot-install
	$(ROBOT) --variable BASE_URL:http://localhost:4321 --variable API_URL:http://localhost:8000 \
	         --outputdir robot/results \
	         robot/ui/

test-robot: robot-install
	$(ROBOT) --variable BASE_URL:http://localhost:4321 --variable API_URL:http://localhost:8000 \
	         --outputdir robot/results \
	         robot/

# ── Health check ───────────────────────────────────────────────────────────
health:
	curl -s http://localhost:8000/health | python3 -m json.tool

# ── Clean ──────────────────────────────────────────────────────────────────
clean:
	rm -rf dist/ .astro/ backend/__pycache__ backend/app/__pycache__ \
		backend/tests/__pycache__ backend/app/**/__pycache__ robot/results
