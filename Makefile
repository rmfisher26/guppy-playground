# ── Guppy Playground Makefile ──────────────────────────────────────────────
.PHONY: dev build backend frontend test test-backend install clean

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
backend:
	cd backend && uvicorn app.main:app --reload --port 8000

backend-install:
	cd backend && pip install -r requirements.txt

# ── Tests ──────────────────────────────────────────────────────────────────
test-backend:
	cd backend && pytest tests/ -v

test-backend-unit:
	cd backend && pytest tests/test_api.py -v

test-backend-routes:
	cd backend && pytest tests/test_routes.py -v

# ── Health check ───────────────────────────────────────────────────────────
health:
	curl -s http://localhost:8000/health | python3 -m json.tool

# ── Clean ──────────────────────────────────────────────────────────────────
clean:
	rm -rf dist/ .astro/ backend/__pycache__ backend/app/__pycache__ \
		backend/tests/__pycache__ backend/app/**/__pycache__
