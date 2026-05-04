import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePlaygroundStore, resolveIsDark } from '../../lib/store';

const readOnlyTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px', fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace" },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': { border: 'none', borderRight: '1px solid var(--border)' },
  '.cm-focused': { outline: 'none' },
});

const lightEditorTheme = EditorView.theme({
  '&': { background: '#f5f5f3', color: '#0d0f14' },
  '.cm-content': { caretColor: '#0d0f14' },
  '.cm-gutters': { background: '#eeedeb', color: '#989898' },
  '.cm-activeLineGutter': { background: '#e4e3e0' },
  '.cm-activeLine': { background: 'rgba(0,0,0,0.025)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'rgba(48, 160, 142, 0.15)',
  },
  '::selection': { background: 'rgba(48, 160, 142, 0.15)' },
});

const lightHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: t.propertyName, color: '#0a6e5f' },   // JSON keys — dark teal
  { tag: t.string,       color: '#6f3800' },   // string values — amber
  { tag: t.number,       color: '#0550ae' },   // numbers — blue
  { tag: t.bool,         color: '#cf222e' },   // true/false — red
  { tag: t.null,         color: '#8250df' },   // null — purple
  { tag: t.punctuation,  color: '#57606a' },   // : , { } [ ]
  { tag: t.bracket,      color: '#24292f' },
]));

function JsonViewer({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { theme } = usePlaygroundStore();
  const isDark = resolveIsDark(theme);

  useEffect(() => {
    if (!containerRef.current) return;
    viewRef.current?.destroy();

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        json(),
        isDark ? oneDark : [lightEditorTheme, lightHighlight],
        readOnlyTheme,
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
      ],
    });

    viewRef.current = new EditorView({ state, parent: containerRef.current });
    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, [content, isDark]);

  return <div ref={containerRef} style={{ height: '100%' }} />;
}

export default function HugrTab() {
  const { runState } = usePlaygroundStore();

  if (runState.status !== 'success' || !runState.response.compile) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>No HUGR graph yet</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          Compile the program to inspect the<br />HUGR intermediate representation.
        </div>
      </div>
    );
  }

  const { hugr_json, node_count } = runState.response.compile;

  if (!hugr_json) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>HUGR JSON unavailable</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '10px 16px 8px', flexShrink: 0,
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        HUGR IR · {node_count} nodes
      </div>
      <div style={{ flex: 1, overflow: 'hidden', margin: '0 16px 16px' }}>
        <JsonViewer content={JSON.stringify(hugr_json, null, 2)} />
      </div>
    </div>
  );
}
