from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field


# ── Request ────────────────────────────────────────────────────────────────

class SimulatorBackend(str, Enum):
    stabilizer  = "stabilizer"   # Stim — fast, works with any circuit
    statevector = "statevector"  # QuEST — exact amplitudes, max 20 qubits


class NoiseModelKind(str, Enum):
    depolarizing = "depolarizing"


class RunRequest(BaseModel):
    source:      str
    filename:    str = "main.py"         # display name shown in error messages
    entry_point: str | None = None       # inferred from @guppy fn if None
    shots:       int        = Field(1024, ge=1, le=8192)
    simulator:   SimulatorBackend = SimulatorBackend.stabilizer
    seed:        int | None = None
    noise_model: NoiseModelKind | None = None
    error_rate:  float = Field(0.001, ge=0.0, le=1.0)


# ── Compile output ─────────────────────────────────────────────────────────

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
    hugr_json:       dict | None = None
    hugr_nodes:      list[HugrNode]
    node_count:      int
    qubit_count:     int = 2
    warnings:        list[CompileWarning] = []
    compile_time_ms: int


# ── Simulation output ──────────────────────────────────────────────────────

class SimulationResults(BaseModel):
    counts:           dict[str, int]
    noisy_counts:     dict[str, int] | None = None
    register_names:   list[str] | None = None
    simulate_time_ms: int


# ── Run response ───────────────────────────────────────────────────────────

class RunStatus(str, Enum):
    ok             = "ok"
    compile_error  = "compile_error"
    timeout        = "timeout"
    internal_error = "internal_error"


class RunResponse(BaseModel):
    status:      RunStatus
    compile:     CompileSuccess | None = None
    results:     SimulationResults | None = None
    errors:      list[CompileError] | None = None
    message:     str | None = None
    request_id:  str | None = None


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
    status:            str    # "ok" | "degraded"
    guppylang_version: str
    selene_version:    str
    uptime_seconds:    float
