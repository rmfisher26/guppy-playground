import { create } from 'zustand';
import type { RunState, OutputTab, Example, CompileError } from './types';

interface PlaygroundStore {
  // Editor
  source: string;
  setSource: (src: string) => void;
  isModified: boolean;
  setModified: (v: boolean) => void;

  // Config
  shots: number;
  setShots: (n: number) => void;
  simulator: 'stabilizer' | 'statevector';
  setSimulator: (s: 'stabilizer' | 'statevector') => void;
  seed: number | undefined;
  setSeed: (n: number | undefined) => void;

  // Examples
  examples: Example[];
  setExamples: (e: Example[]) => void;
  activeExampleId: string;
  setActiveExample: (id: string) => void;

  // Run state machine
  runState: RunState;
  setRunState: (s: RunState) => void;

  // Output UI
  activeTab: OutputTab;
  setActiveTab: (t: OutputTab) => void;

  // Inline error markers for CodeMirror
  errorMarkers: CompileError[];

  // Toast
  toastMessage: string | null;
  showToast: (msg: string) => void;
  hideToast: () => void;
}

export const usePlaygroundStore = create<PlaygroundStore>((set) => ({
  source: '',
  setSource: (source) => set({ source, isModified: true }),
  isModified: false,
  setModified: (isModified) => set({ isModified }),

  shots: 1024,
  setShots: (shots) => set({ shots }),
  simulator: 'stabilizer',
  setSimulator: (simulator) => set({ simulator }),
  seed: undefined,
  setSeed: (seed) => set({ seed }),

  examples: [],
  setExamples: (examples) => set({ examples }),
  activeExampleId: '',
  setActiveExample: (activeExampleId) => set({ activeExampleId }),

  runState: { status: 'idle' },
  setRunState: (runState) => {
    const errorMarkers =
      runState.status === 'compile_error' ? runState.errors : [];
    set({ runState, errorMarkers });
  },

  activeTab: 'output',
  setActiveTab: (activeTab) => set({ activeTab }),

  errorMarkers: [],

  toastMessage: null,
  showToast: (toastMessage) => set({ toastMessage }),
  hideToast: () => set({ toastMessage: null }),
}));
