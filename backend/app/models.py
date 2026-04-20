from __future__ import annotations
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


# ── Request ────────────────────────────────────────────────────────────────

class SimulatorBackend(str, Enum):
    stabilizer  = "stabilizer"   # Stim — fast, Clifford-only
    statevector = "statevector"  # QuEST — exact, general


class RunRequest(BaseModel):
    source:      str
    entry_point: str | None = None       # inferred if None
    shots:       int         = Field(1024, ge=1, le=8192)
    simulator:   SimulatorBackend = SimulatorBackend.stabilizer
    seed:        int | None  = None


# ── Compile models ────────────────────────────────────────────────────────

class ErrorKind(str, Enum):
    linearity_error = "linearity_error"
    type_error      = "type_error"
    syntax_error    = "syntax_error"
    name_error      = "name_error"
    internal_error  = "internal_error"


class CompileError(BaseModel):
    message: str
    line:    int
    col:     int = 0
    kind:    ErrorKind = ErrorKind.internal_error


class CompileWarning(BaseModel):
    message: str
    line:    int
    col:     int = 0


class HugrNode(BaseModel):
    id:     str
    type:   str        # DFG | FuncDef | Call | Gate | Measure | Const | Input | Output
    name:   str
    meta:   str = ""
    parent: str | None = None
    depth:  int = 0


class CompileSuccess(BaseModel):
    hugr_json:    str                    # raw JSON string — passed directly to simulate worker
    hugr_nodes:   list[HugrNode]
    node_count:   int
    warnings:     list[CompileWarning] = []
    compile_time_ms: int


# ── Simulation models ──────────────────────────────────────────────────────

class StatevectorEntry(BaseModel):
    amplitude: tuple[float, float]
    basis:     str


class SimulationResults(BaseModel):
    counts:              dict[str, int]
    expectation_values:  dict[str, float] | None = None
    statevector:         list[StatevectorEntry] | None = None
    simulate_time_ms:    int


# ── Run response ───────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    ok             = "ok"
    compile_error  = "compile_error"
    timeout        = "timeout"
    rate_limited   = "rate_limited"
    internal_error = "internal_error"


class RunResponse(BaseModel):
    status:          RunStatus
    compile:         CompileSuccess | None = None
    results:         SimulationResults | None = None
    errors:          list[CompileError] | None = None
    message:         str | None = None
    retry_after_ms:  int | None = None
    request_id:      str | None = None


# ── Examples ───────────────────────────────────────────────────────────────

class Example(BaseModel):
    id:            str
    title:         str
    description:   str
    tags:          list[str]
    source:        str
    default_shots: int = 1024
    qubit_count:   int
    group:         str


class ExamplesResponse(BaseModel):
    examples: list[Example]


# ── Health ─────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status:             str        # "ok" | "degraded"
    guppylang_version:  str
    selene_version:     str
    uptime_seconds:     float
