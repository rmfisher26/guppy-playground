import { useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { run as apiRun } from '../../lib/api';

export function useRun() {
  const store = usePlaygroundStore();

  // Ctrl+Enter global shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        run();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  async function run() {
    const { source, shots, simulator, seed, setRunState, setActiveTab } = usePlaygroundStore.getState();
    const isRunning = store.runState.status === 'compiling' || store.runState.status === 'simulating';
    if (isRunning) return;

    const start = performance.now();

    // Step 1: compiling
    setRunState({ status: 'compiling' });
    setActiveTab('output');

    try {
      // Small delay so "Compiling…" state is visible before response
      const response = await apiRun({ source, shots, simulator, seed });
      const elapsed_ms = Math.round(performance.now() - start);

      if (response.status === 'ok') {
        setRunState({ status: 'success', response, elapsed_ms });
        // Auto-switch to results tab on success
        setActiveTab('results');
      } else if (response.status === 'compile_error') {
        setRunState({ status: 'compile_error', errors: response.errors ?? [] });
        setActiveTab('output');
      } else if (response.status === 'timeout') {
        setRunState({ status: 'timeout' });
      } else if (response.status === 'rate_limited') {
        setRunState({ status: 'rate_limited', retry_after_ms: response.retry_after_ms ?? 5000 });
      } else {
        setRunState({ status: 'internal_error', message: response.message ?? 'Unknown error' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error — is the backend running?';
      setRunState({ status: 'internal_error', message });
    }
  }

  return { run };
}
