# Contributing to Guppy Playground

Thanks for your interest in contributing! This guide covers how to get the project running locally and how to submit changes. For an overview of the codebase layout, see the [project structure section in the README](README.md#project-structure).

## Development setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Docker (optional, for full-stack dev)

### Frontend only

The frontend falls back to mock API responses when the backend is unavailable, so this is the fastest way to start:

```bash
cd frontend
npm install
npm run dev
# → http://localhost:4321
```

### Full stack

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

To run backend tests:

```bash
cd backend
pytest
```

## Making changes

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. If you changed the backend, run `pytest` and make sure all tests pass.
4. If you changed the frontend, run `npm run build` inside `frontend/` to catch type errors.
5. Open a pull request against `main` with a clear description of what changed and why.

## What to work on

Check the [Issues](../../issues) tab for open bugs and feature requests. Issues labelled `good first issue` are a good starting point.

If you want to propose a larger change, open an issue first so we can discuss the approach before you invest time writing code.

## Code style

- **Frontend:** TypeScript + React. No additional linter config is enforced, but match the style of surrounding code.
- **Backend:** Python. Follow [PEP 8](https://peps.python.org/pep-0008/). Keep route handlers thin — business logic belongs in dedicated modules.

## Reporting bugs

Open a GitHub Issue with:
- What you did
- What you expected to happen
- What actually happened
- Your OS and browser (for frontend issues) or Python version (for backend issues)
