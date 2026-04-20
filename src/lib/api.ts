import type { RunRequest, RunResponse, HealthResponse, ExamplesResponse } from './types';

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

// Encode editor source into URL hash for share links
export function encodeShareUrl(source: string): string {
  const encoded = btoa(encodeURIComponent(source));
  const url = new URL(window.location.href);
  url.hash = `code=${encoded}`;
  return url.toString();
}

// Decode source from URL hash on page load
export function decodeShareUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const match = hash.match(/^#code=(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(atob(match[1]));
  } catch {
    return null;
  }
}
