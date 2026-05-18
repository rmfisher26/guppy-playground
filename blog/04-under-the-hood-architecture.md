# Under the Hood: How the Playground Compiles and Runs Your Code

*Posted on guppyfisher.dev*

---

When you hit `Ctrl+Enter` in [pond.guppyfisher.dev](https://pond.guppyfisher.dev), a lot happens in the ~1-2 seconds before you see your results. This post explains the full stack: the frontend, the API, the sandbox, and one interesting constraint that forced a design decision.

## The Stack

```
Browser (Astro + React)
    ↓ POST /run (JSON)
FastAPI (Python)
    ↓ spawns subprocess
Sandboxed worker (_compile_worker.py)
    → guppylang compile
    → Selene simulate
    ← JSON result on stdout
    ↓
FastAPI parses + responds
    ↓
React renders histogram + HUGR
```

There are two meaningful tiers: the frontend (a static site) and the backend (a Python API running on Google Cloud Run).

---

## Frontend: Astro + React

The frontend is built with [Astro](https://astro.build/) as the outer shell and React for all the interactive components. Astro handles the static page render; React handles everything inside the editor pane, the output pane, and the toolbar.

The editor is [CodeMirror 6](https://codemirror.net/). After a failed compile, the backend returns error objects with exact line and column numbers, which get turned into CodeMirror decorations — red underlines on the offending lines, gutter markers, and a tooltip on hover.

Global state lives in [Zustand](https://github.com/pmndrs/zustand) — a single flat store for source code, run state, results, simulator settings, and the active example. No Redux, no context pyramid.

The typed API client is a thin wrapper around `fetch` with no third-party HTTP library.

---

## Backend: FastAPI

The backend is a FastAPI application with three routes:

| Route | Purpose |
|-------|---------|
| `POST /run` | Compile + simulate Guppy source |
| `GET /examples` | Return the built-in example programs |
| `GET /health` | Version info + uptime |

The `/run` handler accepts a JSON payload:

```json
{
  "source":     "from guppylang import guppy ...",
  "shots":      1024,
  "simulator":  "stabilizer",
  "seed":       null,
  "noise_model": null,
  "error_rate":  0.001,
  "version":    null
}
```

Everything is validated by Pydantic models before the handler runs. Shot count is bounded (1–8192), error rate is bounded (0–1.0), and the version string is checked against a pinned allowlist before any subprocess is launched.

---

## The Sandbox: Why a Subprocess?

The most important design decision in the backend is that user code **never runs in the FastAPI process**.

Running untrusted code (and user-submitted Guppy programs are, by definition, untrusted) inside the web server process is a hard no: a crash in the user's program would crash the server, resource exhaustion would affect all concurrent requests, and there's no clean way to enforce a wall-clock timeout on Python code running in-process.

Instead, each `/run` request spawns a fresh subprocess (`_compile_worker.py`) that:

1. Reads the request payload from stdin as JSON
2. Compiles the Guppy source with `guppylang`
3. Runs the simulator with `selene`
4. Writes the result to stdout as JSON
5. Exits

The parent process waits up to 60 seconds (a generous budget for compile + simulate), reads stdout, and parses the result. If the subprocess exceeds the timeout, it's killed and the user gets a timeout error.

This means one misbehaving request can't take down the server. The subprocess exits, the parent moves on.

---

## The Memory Limit Problem

Here's the interesting constraint: I initially tried setting `RLIMIT_AS` (virtual address space limit) on the subprocess to cap memory usage. This immediately broke every request.

The reason: `guppylang` imports `numpy`, which imports `OpenBLAS`, which reserves around 400 MB of virtual address space at import time — before any user code runs. Setting `RLIMIT_AS` to anything under ~600 MB causes OpenBLAS to fail with "Memory allocation still failed after 10 retries" on the very first import.

The correct solution is Docker's `mem_limit` in `docker-compose.yml`, which uses Linux cgroups on the container level. This enforces a real memory ceiling without interfering with the virtual address space tricks that numerical libraries rely on.

```yaml
# docker-compose.yml
services:
  backend:
    mem_limit: 1g
    memswap_limit: 1g   # disables swap so OOM kills cleanly
```

It's a good example of why process-level resource limits and container-level resource limits solve different problems — and why you shouldn't assume `RLIMIT_AS` is the right tool for memory enforcement in a Python environment.

---

## Multiple guppylang Versions

The version selector in the toolbar lets you run against different pinned releases of `guppylang`. The default version uses the pre-installed interpreter (the fast path). Alternate versions use `uv run --with guppylang==X.Y.Z` to spin up an isolated environment on demand — no pre-installation required.

The version map is maintained in `config.py` as a hand-curated dict of tested `(guppylang, selene-sim)` pairs:

```python
COMPATIBLE_VERSIONS: dict[str, dict] = {
    "0.21.14": {"selene_sim": "0.2.15", "tested": True},
}
```

A GitHub Actions workflow checks for new releases weekly and opens a PR if a new compatible pair is found.

---

## The HUGR Output

After a successful compile, the worker also serializes the HUGR graph to JSON. The backend parses this into a flat list of typed nodes (DFG, FuncDef, Gate, Measure, etc.) and sends them to the frontend. The HUGR tab in the output pane renders these as a node tree — useful for seeing exactly what the compiler produced before it went to the simulator.

---

## Next Post

The last post in this series covers deployment: how the backend lands on Google Cloud Run, how the frontend is served via its own Cloud Run container, and how the whole thing is wired together with Terraform.
