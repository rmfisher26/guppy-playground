import type { RunRequest, RunResponse, HealthResponse, ExamplesResponse, SimulatorBackend, NoiseModelKind } from './types';

export type ShareConfig = {
  source: string;
  shots: number;
  simulator: SimulatorBackend;
  noiseModel: NoiseModelKind | null;
  errorRate: number;
};

const BASE_URL = import.meta.env.PUBLIC_API_URL ?? '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// POST /run  — compile + simulate in one round-trip
export async function run(req: RunRequest): Promise<RunResponse> {
  return request<RunResponse>('/run', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

// GET /examples
export async function fetchExamples(): Promise<ExamplesResponse> {
  return request<ExamplesResponse>('/examples');
}

// GET /health
export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

// Encode the full run config into URL hash for share links
export function encodeShareUrl(config: ShareConfig): string {
  const encoded = btoa(encodeURIComponent(JSON.stringify(config)));
  const url = new URL(window.location.href);
  url.hash = `code=${encoded}`;
  return url.toString();
}

// Decode run config from URL hash on page load.
// Handles both the current JSON format and legacy source-only links.
export function decodeShareUrl(): ShareConfig | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/^#code=(.+)$/);
  if (!match) return null;
  try {
    const raw = decodeURIComponent(atob(match[1]));
    try {
      return JSON.parse(raw) as ShareConfig;
    } catch {
      // Legacy format: plain source string
      return { source: raw, shots: 1024, simulator: 'stabilizer', noiseModel: null, errorRate: 0.001 };
    }
  } catch {
    return null;
  }
}
