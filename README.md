# Guppy Playground

A browser-based IDE for writing and running [Guppy](https://github.com/Quantinuum/guppylang) quantum programs using the [Selene](https://github.com/Quantinuum/selene) emulator.

Built with Astro + React (frontend) and FastAPI (backend).

---

## Quick start

### Frontend only (uses mock API fallback)

```bash
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

---

## Project structure

```
guppy-playground/
├── src/
│   ├── components/
│   │   ├── Playground.tsx  # Root layout component
│   │   ├── ui/             # Header, Toolbar, Toast
│   │   ├── sidebar/        # Example list
│   │   ├── editor/         # EditorPane, GuppyEditor (CodeMirror 6 + error decorations)
│   │   ├── output/         # OutputPane, TerminalOutput, ResultsTab, HugrTab
│   │   └── hooks/          # useRun — run lifecycle + Ctrl+Enter
│   ├── lib/
│   │   ├── api.ts          # Typed fetch client
│   │   ├── store.ts        # Zustand global state
│   │   ├── types.ts        # Shared TypeScript types
│   │   ├── examples.ts     # Static fallback examples
│   │   ├── defaultSource.ts # Default editor program
│   │   └── useMobile.ts    # Responsive breakpoint hook
│   ├── pages/
│   │   └── index.astro
│   ├── env.d.ts
│   └── styles/
│       ├── tokens.css      # CSS variables
│       └── global.css
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
│       └── deploy-backend.yml  # Cloud Run deploy on push to main
├── .env.example
├── Makefile
├── docker-compose.yml
├── astro.config.mjs
├── package.json
└── tsconfig.json
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

## Development notes

- **guppylang not installed?** The frontend falls back to static examples and
  the simulator worker emits mock Bell pair results so the UI stays fully functional.
- **Keyboard shortcut:** `Ctrl+Enter` runs the current program from anywhere.
- **Share links:** the Share button encodes the editor source as a base64 URL
  hash — paste into any browser to restore the exact program.
- **Error highlighting:** compile errors map to CodeMirror line decorations
  automatically via the `errorMarkers` store field.
