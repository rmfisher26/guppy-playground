import { useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { run as apiRun, fetchHealth } from '../../lib/api';

let backendReady = false;

// Derive the display filename from the active slot and example list.
// Matches what the user sees in the editor header.
function deriveFilename(activeSlot: string, examples: { id: string }[]): string {
  if (activeSlot === 'workspace') return 'main.py';
  const ex = examples.find(e => e.id === activeSlot);
  if (!ex) return 'main.py';
  // "bell" → "bell.py", "repeat-until-success" → "repeat_until_success.py"
  return ex.id.replace(/-/g, '_') + '.py';
}

export function useRun() {
  function isRunning() {
    return ['compiling', 'simulating', 'preparing'].includes(usePlaygroundStore.getState().runState.status);
  }

  async function run() {
    const { source, shots, simulator, seed, noiseModel, errorRate, guppyVersion, activeSlot, examples, setRunState, setActiveTab, setSimulator } =
      usePlaygroundStore.getState();

    if (isRunning()) return;

    const filename = deriveFilename(activeSlot, examples);
    const start = performance.now();

    if (!backendReady) {
      setRunState({ status: 'preparing' });
      try { await fetchHealth(); } catch { /* proceed regardless */ }
      backendReady = true;
    }

    setRunState({ status: 'compiling' });
    setActiveTab('output');

    const effectiveSimulator = /\bstate_result\s*\(/.test(source) ? 'statevector' : simulator;
    if (effectiveSimulator !== simulator) setSimulator(effectiveSimulator);

    try {
      const response = await apiRun({
        source, filename, shots, simulator: effectiveSimulator, seed,
        ...(noiseModel ? { noise_model: noiseModel, error_rate: errorRate } : {}),
        ...(guppyVersion ? { version: guppyVersion } : {}),
      });
      const elapsed_ms = Math.round(performance.now() - start);

      if (response.status === 'ok') {
        setRunState({ status: 'success', response, elapsed_ms, simulator: effectiveSimulator });
        const hasStateSnapshots =
          (response.results?.state_snapshots?.length ?? 0) > 0 &&
          (response.results?.state_snapshots?.[0]?.length ?? 0) > 0;
        const sourceUsesStateResult = /\bstate_result\s*\(/.test(source);
        setActiveTab((hasStateSnapshots || sourceUsesStateResult) ? 'state' : 'results');
      } else if (response.status === 'compile_error') {
        setRunState({ status: 'compile_error', errors: response.errors ?? [], stdout: response.stdout });
        setActiveTab('output');
      } else if (response.status === 'timeout') {
        setRunState({ status: 'timeout' });
      } else {
        setRunState({ status: 'internal_error', message: response.message ?? 'Unknown error' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — is the backend running?';
      setRunState({ status: 'internal_error', message });
    }
  }

  async function compile() {
    const { source, simulator, guppyVersion, activeSlot, examples, setRunState, setActiveTab } =
      usePlaygroundStore.getState();

    if (isRunning()) return;

    const filename = deriveFilename(activeSlot, examples);
    const start = performance.now();

    if (!backendReady) {
      setRunState({ status: 'preparing' });
      try { await fetchHealth(); } catch { /* proceed regardless */ }
      backendReady = true;
    }

    setRunState({ status: 'compiling', compileOnly: true });
    setActiveTab('output');

    try {
      const response = await apiRun({
        source, filename, shots: 1, simulator,
        compile_only: true,
        ...(guppyVersion ? { version: guppyVersion } : {}),
      });
      const elapsed_ms = Math.round(performance.now() - start);

      if (response.status === 'ok') {
        setRunState({ status: 'success', response, elapsed_ms, simulator });
        setActiveTab('hugr');
      } else if (response.status === 'compile_error') {
        setRunState({ status: 'compile_error', errors: response.errors ?? [], stdout: response.stdout });
        setActiveTab('output');
      } else if (response.status === 'timeout') {
        setRunState({ status: 'timeout' });
      } else {
        setRunState({ status: 'internal_error', message: response.message ?? 'Unknown error' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — is the backend running?';
      setRunState({ status: 'internal_error', message });
    }
  }

  // Ctrl+Enter → run; Ctrl+Shift+Enter → compile only
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) compile();
        else run();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return { run, compile };
}
