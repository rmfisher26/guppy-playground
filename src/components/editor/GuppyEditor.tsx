import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, StateEffect, StateField, RangeSet } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePlaygroundStore } from '../../lib/store';
import type { CompileError } from '../../lib/types';

// ── Error decoration effect ──────────────────────────────────────────────
const setErrorsEffect = StateEffect.define<CompileError[]>();

const errorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setErrorsEffect)) {
        const marks = effect.value.flatMap(err => {
          try {
            const line = tr.state.doc.line(err.line);
            return [
              Decoration.mark({ class: 'cm-error-line' }).range(line.from, line.to),
            ];
          } catch {
            return [];
          }
        });
        decorations = marks.length > 0
          ? RangeSet.of(marks.sort((a, b) => a.from - b.from))
          : Decoration.none;
      }
    }
    return decorations;
  },
  provide: f => EditorView.decorations.from(f),
});

// ── Guppy theme override (on top of oneDark) ─────────────────────────────
const guppyTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    background: 'var(--bg-base)',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '20px',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '16px 0',
    caretColor: 'var(--teal)',
  },
  '.cm-gutters': {
    background: 'var(--bg-base)',
    border: 'none',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
    minWidth: '48px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 4px',
    minWidth: '40px',
    textAlign: 'right',
  },
  '.cm-activeLine': { background: 'rgba(0,180,216,0.04)' },
  '.cm-activeLineGutter': { background: 'rgba(0,180,216,0.08)', color: 'var(--text-secondary)' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(0,180,216,0.15) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--teal)' },
  '.cm-error-line': {
    background: 'rgba(248,81,73,0.08)',
    borderLeft: '2px solid var(--red)',
  },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(0,180,216,0.2)' },
});

interface GuppyEditorProps {
  onReady?: (view: EditorView) => void;
}

export default function GuppyEditor({ onReady }: GuppyEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { source, setSource, setModified, errorMarkers } = usePlaygroundStore();

  // Apply error decorations when errorMarkers change
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: setErrorsEffect.of(errorMarkers),
    });
  }, [errorMarkers]);

  // Sync source from store → editor (when example changes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== source) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: source },
      });
    }
  }, [source]);

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        const newSource = update.state.doc.toString();
        setSource(newSource);
        setModified(true);
      }
    });

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        python(),
        oneDark,
        guppyTheme,
        errorField,
        updateListener,
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorState.tabSize.of(4),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', height: '100%' }}
    />
  );
}
