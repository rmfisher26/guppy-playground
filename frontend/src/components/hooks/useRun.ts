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
    const { source, shots, simulator, seed, activeSlot, examples, setRunState, setActiveTab } =
      usePlaygroundStore.getState();

    const isRunning = ['compiling', 'simulating', 'preparing'].includes(store.runState.status);
    if (isRunning) return;

    const filename = deriveFilename(activeSlot, examples);
    const start = performance.now();

    if (!backendReady) {
      setRunState({ status: 'preparing' });
      try { await fetchHealth(); } catch { /* proceed regardless */ }
      backendReady = true;
    }

    setRunState({ status: 'compiling' });
    setActiveTab('output');

    try {
      const response = await apiRun({ source, filename, shots, simulator, seed });
      const elapsed_ms = Math.round(performance.now() - start);

      if (response.status === 'ok') {
        setRunState({ status: 'success', response, elapsed_ms });
        setActiveTab('results');
      } else if (response.status === 'compile_error') {
        setRunState({ status: 'compile_error', errors: response.errors ?? [] });
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

  return { run };
}
