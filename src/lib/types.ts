// ── API TYPES ──────────────────────────────────────────────────────────────

export type SimulatorBackend = 'stabilizer' | 'statevector';

export interface RunRequest {
  source: string;
  entry_point?: string;
  shots: number;
  simulator: SimulatorBackend;
  seed?: number;
}

export interface HugrNode {
  id: string;
  type: 'DFG' | 'FuncDef' | 'Call' | 'Gate' | 'Measure' | 'Const' | 'Input' | 'Output';
  name: string;
  meta: string;
  parent?: string;
  depth: number;
}

export interface CompileWarning {
  message: string;
  line: number;
  col: number;
}

export interface CompileSuccess {
  hugr_json: Record<string, unknown>;
  hugr_nodes: HugrNode[];
  node_count: number;
  warnings: CompileWarning[];
  compile_time_ms: number;
}

export type ErrorKind = 'linearity_error' | 'type_error' | 'syntax_error' | 'name_error' | 'internal_error';

export interface CompileError {
  message: string;
  line: number;
  col: number;
  kind: ErrorKind;
}

export interface SimulationResults {
  counts: Record<string, number>;
  expectation_values?: Record<string, number>;
  statevector?: Array<{ amplitude: [number, number]; basis: string }>;
  simulate_time_ms: number;
}

export type RunStatus = 'ok' | 'compile_error' | 'timeout' | 'rate_limited' | 'internal_error';

export interface RunResponse {
  status: RunStatus;
  compile?: CompileSuccess;
  results?: SimulationResults;
  errors?: CompileError[];
  message?: string;
  retry_after_ms?: number;
  request_id?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  guppylang_version: string;
  selene_version: string;
  uptime_seconds: number;
}

export interface Example {
  id: string;
  title: string;
  description: string;
  tags: string[];
  source: string;
  default_shots: number;
  qubit_count: number;
  group: string;
}

export interface ExamplesResponse {
  examples: Example[];
}

export type RunState =
  | { status: 'idle' }
  | { status: 'compiling' }
  | { status: 'simulating' }
  | { status: 'success'; response: RunResponse; elapsed_ms: number }
  | { status: 'compile_error'; errors: CompileError[] }
  | { status: 'timeout' }
  | { status: 'rate_limited'; retry_after_ms: number }
  | { status: 'internal_error'; message: string };

export type OutputTab = 'output' | 'results' | 'hugr';
