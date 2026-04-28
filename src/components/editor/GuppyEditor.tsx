import React, { useEffect, useRef } from 'react';
import { EditorState, StateEffect, StateField, RangeSet, Compartment } from '@codemirror/state';
import { EditorView, Decoration, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePlaygroundStore, resolveIsDark } from '../../lib/store';
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
            return [Decoration.mark({ class: 'cm-error-line' }).range(line.from, line.to)];
          } catch { return []; }
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

// ── Dark theme (oneDark + overrides) ────────────────────────────────────
const guppyDarkTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", background: '#0d1117' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '20px', overflow: 'auto' },
  '.cm-content': { padding: '16px 0', caretColor: '#00b4d8' },
  '.cm-gutters': { background: '#0d1117', border: 'none', borderRight: '1px solid #2a3444', color: '#4d5d70', minWidth: '48px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 4px', minWidth: '40px', textAlign: 'right' },
  '.cm-activeLine': { background: 'rgba(0,180,216,0.04)' },
  '.cm-activeLineGutter': { background: 'rgba(0,180,216,0.08)', color: '#8b98a8' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(0,180,216,0.15) !important' },
  '.cm-cursor': { borderLeftColor: '#00b4d8' },
  '.cm-error-line': { background: 'rgba(248,81,73,0.08)', borderLeft: '2px solid #f85149' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(0,180,216,0.2)' },
});

// ── Light theme ──────────────────────────────────────────────────────────
// Colors from highlight.js GitHub light theme used on docs.quantinuum.com/guppy/
const lightHighlight = HighlightStyle.define([
  // Keywords: def, class, import, from, return, if, for, with, as, yield…
  { tag: [tags.keyword, tags.moduleKeyword, tags.controlKeyword], color: '#d73a49' },

  // Strings and escape sequences
  { tag: [tags.string, tags.special(tags.string)], color: '#032f62' },

  // Comments
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },

  // Numbers, booleans, null (None/True/False)
  { tag: [tags.number, tags.bool, tags.null], color: '#005cc5' },

  // Operators (+, -, *, =, ==, …) — blue like numbers/literals
  { tag: tags.operator, color: '#005cc5' },

  // Punctuation stays near-black
  { tag: tags.punctuation, color: '#24292e' },

  // Function and class names in definitions → purple
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))], color: '#6f42c1' },
  { tag: [tags.className, tags.definition(tags.typeName)], color: '#6f42c1' },

  // Built-ins and self/cls → orange
  { tag: [tags.self, tags.standard(tags.name)], color: '#e36209' },

  // Type annotations and type names → red (same as keywords)
  { tag: tags.typeName, color: '#d73a49' },

  // Property access (obj.attr)
  { tag: tags.propertyName, color: '#005cc5' },

  // Plain variable names
  { tag: tags.variableName, color: '#24292e' },
]);

const guppyLightTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace", background: '#f5f5f3' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '20px', overflow: 'auto' },
  '.cm-content': { padding: '16px 0', caretColor: '#30a08e', color: '#0d0f14' },
  '.cm-gutters': { background: '#f5f5f3', border: 'none', borderRight: '1px solid #dfdddb', color: '#989898', minWidth: '48px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 4px', minWidth: '40px', textAlign: 'right' },
  '.cm-activeLine': { background: 'rgba(48,160,142,0.05)' },
  '.cm-activeLineGutter': { background: 'rgba(48,160,142,0.08)', color: '#4d4d4d' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(48,160,142,0.18) !important' },
  '.cm-cursor': { borderLeftColor: '#30a08e' },
  '.cm-error-line': { background: 'rgba(255,92,58,0.07)', borderLeft: '2px solid #ff5c3a' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(48,160,142,0.22)' },
}, { dark: false });

// ── Theme compartment (module-level so both effects share it) ────────────
const themeCompartment = new Compartment();

function buildThemeExtensions(isDark: boolean) {
  return isDark
    ? [oneDark, guppyDarkTheme]
    : [guppyLightTheme, syntaxHighlighting(lightHighlight)];
}

interface GuppyEditorProps {
  onReady?: (view: EditorView) => void;
}

export default function GuppyEditor({ onReady }: GuppyEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { source, setSource, setModified, errorMarkers, theme } = usePlaygroundStore();

  // Swap CodeMirror theme when the store theme changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: themeCompartment.reconfigure(buildThemeExtensions(resolveIsDark(theme))) });

    // Also re-fire when system preference flips while theme === 'system'
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      viewRef.current?.dispatch({
        effects: themeCompartment.reconfigure(buildThemeExtensions(resolveIsDark('system'))),
      });
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Apply error decorations when errorMarkers change
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({ effects: setErrorsEffect.of(errorMarkers) });
  }, [errorMarkers]);

  // Sync source from store → editor (when example changes)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== source) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: source } });
    }
  }, [source]);

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        setSource(update.state.doc.toString());
        setModified(true);
      }
    });

    const state = EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        python(),
        themeCompartment.of(buildThemeExtensions(resolveIsDark(usePlaygroundStore.getState().theme))),
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

    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  return <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', height: '100%' }} />;
}
