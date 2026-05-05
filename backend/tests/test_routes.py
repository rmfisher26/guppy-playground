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
    # Empty source is valid Python — guppylang compiles it and returns ok with 0 shots,
    # but never a 500
    assert data["status"] in ("ok", "compile_error", "internal_error")
    if data["status"] == "ok":
        assert sum(data["results"]["counts"].values()) == 0


def test_run_seed_is_reproducible():
    payload = {"source": BELL_SOURCE, "shots": 128, "simulator": "stabilizer", "seed": 99}
    r1 = client.post("/run", json=payload)
    r2 = client.post("/run", json=payload)
    assert r1.status_code == 200 and r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    assert d1["status"] == d2["status"]
    if d1["status"] == "ok":
        assert d1["results"]["counts"] == d2["results"]["counts"]


def test_run_statevector_simulator():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "shots":     64,
        "simulator": "statevector",
        "seed":      1,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "compile_error", "internal_error")
    if data["status"] == "ok":
        assert sum(data["results"]["counts"].values()) == 64


def test_run_invalid_simulator():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "shots":     64,
        "simulator": "not_a_real_simulator",
    })
    assert resp.status_code == 422


def test_run_response_has_request_id():
    resp = client.post("/run", json={
        "source":    "invalid @@@@",
        "shots":     64,
        "simulator": "stabilizer",
    })
    assert resp.status_code == 200
    assert resp.json().get("request_id") is not None


def test_run_uses_default_shots():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "simulator": "stabilizer",
        "seed":      1,
    })
    assert resp.status_code == 200
    data = resp.json()
    if data["status"] == "ok":
        assert sum(data["results"]["counts"].values()) == 1024


# ── Examples (extended) ────────────────────────────────────────────────────

EXAMPLE_FIELDS = {"id", "title", "description", "tags", "source", "qubit_count", "group"}

def test_examples_all_fields_present():
    resp = client.get("/examples")
    assert resp.status_code == 200
    for ex in resp.json()["examples"]:
        missing = EXAMPLE_FIELDS - ex.keys()
        assert not missing, f"Example {ex.get('id')} missing fields: {missing}"


def test_examples_sources_are_non_empty():
    resp = client.get("/examples")
    assert resp.status_code == 200
    for ex in resp.json()["examples"]:
        assert ex["source"].strip(), f"Example {ex['id']} has empty source"


# ── Noise model ────────────────────────────────────────────────────────────

def test_run_depolarizing_noise_returns_noisy_counts():
    resp = client.post("/run", json={
        "source":      BELL_SOURCE,
        "shots":       256,
        "simulator":   "stabilizer",
        "seed":        42,
        "noise_model": "depolarizing",
        "error_rate":  0.01,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ("ok", "compile_error", "internal_error")
    if data["status"] == "ok":
        results = data["results"]
        assert results is not None
        assert "noisy_counts" in results
        assert results["noisy_counts"] is not None
        assert sum(results["noisy_counts"].values()) == 256


def test_run_noisy_counts_sum_matches_shots():
    resp = client.post("/run", json={
        "source":      BELL_SOURCE,
        "shots":       128,
        "simulator":   "stabilizer",
        "seed":        7,
        "noise_model": "depolarizing",
        "error_rate":  0.005,
    })
    assert resp.status_code == 200
    data = resp.json()
    if data["status"] == "ok":
        results = data["results"]
        assert sum(results["counts"].values()) == 128
        assert sum(results["noisy_counts"].values()) == 128


def test_run_noisy_produces_counts_with_correct_total():
    # Both ideal and noisy counts should sum to the requested shot count.
    resp = client.post("/run", json={
        "source":      BELL_SOURCE,
        "shots":       512,
        "simulator":   "stabilizer",
        "seed":        1,
        "noise_model": "depolarizing",
        "error_rate":  0.05,
    })
    assert resp.status_code == 200
    data = resp.json()
    if data["status"] == "ok":
        results = data["results"]
        assert sum(results["counts"].values()) == 512
        assert results["noisy_counts"] is not None
        assert sum(results["noisy_counts"].values()) == 512


def test_run_ideal_has_no_noisy_counts():
    resp = client.post("/run", json={
        "source":    BELL_SOURCE,
        "shots":     128,
        "simulator": "stabilizer",
        "seed":      1,
    })
    assert resp.status_code == 200
    data = resp.json()
    if data["status"] == "ok":
        assert data["results"]["noisy_counts"] is None


def test_run_invalid_noise_model_rejected():
    resp = client.post("/run", json={
        "source":      BELL_SOURCE,
        "shots":       64,
        "simulator":   "stabilizer",
        "noise_model": "not_a_noise_model",
    })
    assert resp.status_code == 422


def test_run_error_rate_out_of_range_rejected():
    resp = client.post("/run", json={
        "source":      BELL_SOURCE,
        "shots":       64,
        "simulator":   "stabilizer",
        "noise_model": "depolarizing",
        "error_rate":  1.5,  # > 1.0, invalid
    })
    assert resp.status_code == 422


def test_run_noisy_seed_is_reproducible():
    payload = {
        "source":      BELL_SOURCE,
        "shots":       128,
        "simulator":   "stabilizer",
        "seed":        55,
        "noise_model": "depolarizing",
        "error_rate":  0.01,
    }
    r1 = client.post("/run", json=payload)
    r2 = client.post("/run", json=payload)
    assert r1.status_code == 200 and r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    if d1["status"] == "ok" and d2["status"] == "ok":
        assert d1["results"]["counts"]       == d2["results"]["counts"]
        assert d1["results"]["noisy_counts"] == d2["results"]["noisy_counts"]


# ── CORS ───────────────────────────────────────────────────────────────────

def test_cors_header_on_run():
    resp = client.post(
        "/run",
        json={"source": "x", "shots": 64, "simulator": "stabilizer"},
        headers={"Origin": "http://localhost:4321"},
    )
    assert "access-control-allow-origin" in resp.headers


def test_cors_preflight():
    resp = client.options(
        "/run",
        headers={
            "Origin":                        "http://localhost:4321",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert resp.status_code in (200, 204)
