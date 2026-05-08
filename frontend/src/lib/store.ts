import { create } from 'zustand';
import type { RunState, OutputTab, Example, CompileError, NoiseModelKind } from './types';
import { DEFAULT_SOURCE } from './defaultSource';

export type Theme = 'dark' | 'light' | 'system';

function loadTheme(): Theme {
  try {
    const v = localStorage.getItem('guppy-theme');
    if (v === 'light' || v === 'system') return v;
  } catch {}
  return 'dark';
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('guppy-theme', theme); } catch {}
}

export function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

// The active "slot" in the editor — either 'workspace' or an example id
export type ActiveSlot = 'workspace' | string;

interface PlaygroundStore {
  // Editor
  source: string;
  setSource: (src: string) => void;
  isModified: boolean;
  setModified: (v: boolean) => void;

  // Workspace — persists the user's own code independently of examples
  workspaceSource: string;
  saveWorkspace: () => void;          // snapshot current source → workspaceSource
  restoreWorkspace: () => void;       // load workspaceSource → source

  // Config
  shots: number;
  setShots: (n: number) => void;
  simulator: 'stabilizer' | 'statevector';
  setSimulator: (s: 'stabilizer' | 'statevector') => void;
  seed: number | undefined;
  setSeed: (n: number | undefined) => void;
  noiseModel: NoiseModelKind | null;
  setNoiseModel: (m: NoiseModelKind | null) => void;
  errorRate: number;
  setErrorRate: (r: number) => void;

  // Active slot — 'workspace' or an example id
  activeSlot: ActiveSlot;
  setActiveSlot: (slot: ActiveSlot) => void;

  // Examples
  examples: Example[];
  setExamples: (e: Example[]) => void;

  // Derived — kept for toolbar compat
  activeExampleId: string;
  setActiveExample: (id: string) => void;

  // Run state machine
  runState: RunState;
  setRunState: (s: RunState) => void;
  runId: number;  // increments on each new run, used to reset per-run UI state

  // Output UI
  activeTab: OutputTab;
  setActiveTab: (t: OutputTab) => void;

  // Inline error markers for CodeMirror
  errorMarkers: CompileError[];

  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
  hideToast: () => void;
}

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  source: DEFAULT_SOURCE,
  setSource: (source) => set({ source, isModified: true }),
  isModified: false,
  setModified: (isModified) => set({ isModified }),

  workspaceSource: DEFAULT_SOURCE,
  saveWorkspace: () => set((s) => ({ workspaceSource: s.source })),
  restoreWorkspace: () => {
    const { workspaceSource } = get();
    set({ source: workspaceSource, activeSlot: 'workspace', activeExampleId: '', isModified: false });
  },

  shots: 1024,
  setShots: (shots) => set({ shots }),
  simulator: 'stabilizer',
  setSimulator: (simulator) => set({ simulator }),
  seed: undefined,
  setSeed: (seed) => set({ seed }),
  noiseModel: null,
  setNoiseModel: (noiseModel) => set({ noiseModel }),
  errorRate: 0.001,
  setErrorRate: (errorRate) => set({ errorRate }),

  activeSlot: 'workspace',
  setActiveSlot: (activeSlot) => set({ activeSlot }),

  examples: [],
  setExamples: (examples) => set({ examples }),

  // activeExampleId mirrors activeSlot for toolbar compat
  activeExampleId: '',
  setActiveExample: (id: string) => {
    const { examples, source, activeSlot } = get();
    const ex = examples.find(e => e.id === id);
    if (!ex) return;
    // Save workspace before leaving it
    if (activeSlot === 'workspace') {
      set({ workspaceSource: source });
    }
    set({ activeExampleId: id, activeSlot: id, source: ex.source, isModified: false });
  },

  runState: { status: 'idle' },
  runId: 0,
  setRunState: (runState) => {
    const errorMarkers =
      runState.status === 'compile_error' ? runState.errors : [];
    const runId = runState.status === 'compiling' ? get().runId + 1 : get().runId;
    set({ runState, errorMarkers, runId });
  },

  activeTab: 'output',
  setActiveTab: (activeTab) => set({ activeTab }),

  errorMarkers: [],

  theme: loadTheme(),
  setTheme: (theme) => { applyTheme(theme); set({ theme }); },

  toastMessage: null,
  showToast: (toastMessage) => set({ toastMessage }),
  hideToast: () => set({ toastMessage: null }),
}));
