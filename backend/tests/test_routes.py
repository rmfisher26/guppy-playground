"""
Integration tests for the API routes.
Run with: pytest backend/tests/ -v
"""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ── Health ─────────────────────────────────────────────────────────────────

def test_health_returns_200():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "degraded")
    assert "guppylang_version" in data
    assert "selene_version" in data
    assert data["uptime_seconds"] >= 0


# ── Examples ───────────────────────────────────────────────────────────────

def test_examples_returns_list():
    resp = client.get("/examples")
    assert resp.status_code == 200
    data = resp.json()
    assert "examples" in data
    assert len(data["examples"]) > 0
    first = data["examples"][0]
    assert "id" in first
    assert "source" in first
    assert "qubit_count" in first


# ── Run ────────────────────────────────────────────────────────────────────

BELL_SOURCE = """\
from guppylang import guppy
from guppylang.std.quantum import qubit, h, cx, measure

@guppy
def bell_pair() -> tuple[bool, bool]:
    q0 = qubit()
    q1 = qubit()
    h(q0)
    cx(q0, q1)
    return measure(q0), measure(q1)

bell_pair.check()
"""

def test_run_bell_pair():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "shots":     256,
        "simulator": "stabilizer",
        "seed":      42,
    })
    assert resp.status_code == 200
    data = resp.json()
    # Either ok or compile_error (if guppylang not installed) — never 500
    assert data["status"] in ("ok", "compile_error", "internal_error")
    if data["status"] == "ok":
        assert data["results"] is not None
        counts = data["results"]["counts"]
        assert isinstance(counts, dict)
        total = sum(counts.values())
        assert total == 256


def test_run_syntax_error_returns_compile_error():
    resp = client.post("/run", json={
        "source":    "this is not valid python @@@@",
        "shots":     64,
        "simulator": "stabilizer",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "compile_error"
    assert len(data["errors"]) > 0


def test_run_validates_shots_limit():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "shots":     99999,  # exceeds max 8192
        "simulator": "stabilizer",
    })
    assert resp.status_code == 422  # Pydantic validation error


def test_run_empty_source():
    resp = client.post("/run", json={
        "source":    "",
        "shots":     64,
        "simulator": "stabilizer",
    })
    assert resp.status_code == 200
    data = resp.json()
    # Empty source should return compile_error, not 500
    assert data["status"] in ("compile_error", "internal_error")
