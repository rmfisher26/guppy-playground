# Guppy Playground

A browser-based IDE for writing and running [Guppy](https://github.com/Quantinuum/guppylang) quantum programs using the [Selene](https://github.com/Quantinuum/selene) emulator.

Built with Astro + React (frontend) and FastAPI (backend).

**[Try it live →](https://pond.guppyfisher.dev)**

---

## Quick start

### Frontend only (uses mock API fallback)

```bash
cd frontend
npm install
npm run dev
# → http://localhost:4321
```

### Full stack (requires Docker)

```bash
docker compose up --build
# → frontend: http://localhost:4321
# → backend:  http://localhost:8000
# → API docs: http://localhost:8000/docs
```

### Backend only

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend tests

```bash
make test-backend
```

Creates a virtual environment under `backend/.venv` automatically on first run (requires [`uv`](https://github.com/astral-sh/uv)). To run a subset:

```bash
make test-backend-unit    # unit tests only (models, sandbox, compiler logic)
make test-backend-routes  # route integration tests only
```

---

## Make commands

| Command                | Description                                       |
|------------------------|---------------------------------------------------|
| `make dev`             | Full stack via Docker Compose                     |
| `make frontend`        | Frontend dev server only                          |
| `make backend`         | Backend dev server only                           |
| `make build`           | Production frontend build                         |
| `make test-backend`    | Create venv (if needed) and run all backend tests |
| `make install`         | Install frontend dependencies                     |
| `make clean`           | Remove build artifacts and caches                 |

---

## Project structure

```
guppy-playground/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Playground.tsx  # Root layout component
│       │   ├── ui/             # Header, Toolbar, Toast
│       │   ├── sidebar/        # Example list
│       │   ├── editor/         # EditorPane, GuppyEditor (CodeMirror 6 + error decorations)
│       │   ├── output/         # OutputPane, TerminalOutput, ResultsTab, HugrTab
│       │   └── hooks/          # useRun — run lifecycle + Ctrl+Enter
│       ├── lib/
│       │   ├── api.ts          # Typed fetch client
│       │   ├── store.ts        # Zustand global state
│       │   ├── types.ts        # Shared TypeScript types
│       │   ├── examples.ts     # Static fallback examples
│       │   ├── defaultSource.ts # Default editor program
│       │   └── useMobile.ts    # Responsive breakpoint hook
│       ├── pages/
│       │   └── index.astro
│       ├── env.d.ts
│       └── styles/
│           ├── tokens.css      # CSS variables
│           └── global.css
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory
│   │   ├── config.py               # Pydantic settings (env vars)
│   │   ├── models.py               # Pydantic request/response models
│   │   ├── compiler.py             # Compile orchestration
│   │   ├── _compile_worker.py      # Sandboxed guppylang subprocess
│   │   ├── sandbox.py              # Subprocess runner + resource limits
│   │   ├── examples_data.py        # Canonical example programs
│   │   └── routes/
│   │       ├── run.py              # POST /run
│   │       ├── health.py           # GET /health
│   │       └── examples.py         # GET /examples
│   ├── tests/
│   │   ├── test_routes.py
│   │   └── test_api.py
│   ├── test_api.sh         # Manual API smoke tests
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── .env.example
│   └── Dockerfile
├── .github/
│   └── workflows/
│       ├── deploy-backend.yml   # Cloud Run deploy on push to main
│       └── deploy-frontend.yml
├── .env.example
├── Makefile
└── docker-compose.yml
```

---

## API

| Method | Path        | Description                     |
|--------|-------------|---------------------------------|
| POST   | `/run`      | Compile + simulate Guppy source |
| GET    | `/examples` | List built-in examples          |
| GET    | `/health`   | Version + uptime check          |
| GET    | `/docs`     | OpenAPI interactive docs        |

### POST /run

```json
{
  "source":    "from guppylang import guppy ...",
  "shots":     1024,
  "simulator": "stabilizer",
  "seed":      42
}
```

Response statuses: `ok` · `compile_error` · `timeout` · `rate_limited` · `internal_error`

---

## Environment variables

### Backend (`backend/.env`)

| Variable                   | Default | Description                              |
|----------------------------|---------|------------------------------------------|
| `COMPILE_TIMEOUT_SECONDS`  | 10      | Max seconds allowed for compilation      |
| `SIMULATE_TIMEOUT_SECONDS` | 15      | Max seconds allowed for simulation       |
| `MAX_SHOTS`                | 8192    | Maximum shots per request                |
| `SANDBOX_MEMORY_MB`        | 512     | Memory limit for the sandbox subprocess  |
| `ALLOWED_ORIGINS`          | localhost + guppyfisher.dev | Comma-separated or JSON array of allowed CORS origins |

### Frontend (`frontend/.env`)

| Variable         | Default                  | Description                    |
|------------------|--------------------------|--------------------------------|
| `PUBLIC_API_URL` | `http://localhost:8000`  | Backend API URL                |

Copy `.env.example` files to `.env` in each directory to override defaults locally.

---

## Development notes

- **guppylang not installed?** The frontend falls back to static examples and
  the simulator worker emits mock Bell pair results so the UI stays fully functional.
- **Keyboard shortcut:** `Ctrl+Enter` runs the current program from anywhere.
- **Share links:** the Share button encodes the editor source as a base64 URL
  hash — paste into any browser to restore the exact program.
- **Error highlighting:** compile errors map to CodeMirror line decorations
  automatically via the `errorMarkers` store field.
