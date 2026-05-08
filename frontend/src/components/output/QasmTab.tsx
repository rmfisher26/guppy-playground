import React, { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { StreamLanguage } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { usePlaygroundStore, resolveIsDark } from '../../lib/store';

// Minimal QASM syntax highlighting via StreamLanguage
const qasmLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.match(/\/\/.*/)) return 'comment';
    if (stream.match(/OPENQASM|include|qreg|creg|gate|measure|barrier|reset|if/))
      return 'keyword';
    if (stream.match(/\d+(\.\d+)?/)) return 'number';
    if (stream.match(/"[^"]*"/)) return 'string';
    if (stream.match(/[a-zA-Z_]\w*/)) return 'variableName';
    stream.next();
    return null;
  },
  name: 'qasm',
});

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
  '.cm-activeLine': { background: 'rgba(0,0,0,0.025)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'rgba(48, 160, 142, 0.15)',
  },
});

function QasmViewer({ content }: { content: string }) {
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
        qasmLanguage,
        isDark ? oneDark : lightEditorTheme,
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

export default function QasmTab() {
  const { runState, showToast } = usePlaygroundStore();
  const [copyHovered, setCopyHovered] = useState(false);
  const [dlHovered, setDlHovered] = useState(false);
  const [tketHovered, setTketHovered] = useState(false);

  if (runState.status !== 'success' || !runState.response.compile) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>◫</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>No QASM yet</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          Compile the program to export<br />an OpenQASM 2.0 circuit.
        </div>
      </div>
    );
  }

  const { qasm, qubit_count } = runState.response.compile;

  if (!qasm) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>◫</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>QASM unavailable</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          QASM export requires a circuit with<br />at least one qubit allocation.
        </div>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(qasm!).then(() => showToast('QASM copied to clipboard'));
  }

  function handleDownload() {
    const blob = new Blob([qasm!], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'circuit.qasm';
    a.click();
    URL.revokeObjectURL(url);
  }

  const btnBase: React.CSSProperties = {
    height: 22, padding: '0 10px',
    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 600,
    borderRadius: 4, border: '1px solid var(--border)',
    cursor: 'pointer', transition: 'background 0.12s, color 0.12s',
    display: 'flex', alignItems: 'center', gap: 5,
    letterSpacing: '0.04em',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
          flex: 1,
        }}>
          OpenQASM 2.0 · {qubit_count} qubit{qubit_count !== 1 ? 's' : ''}
        </span>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          onMouseEnter={() => setCopyHovered(true)}
          onMouseLeave={() => setCopyHovered(false)}
          style={{
            ...btnBase,
            background: copyHovered ? 'var(--teal)' : 'transparent',
            color: copyHovered ? '#fff' : 'var(--text-secondary)',
            borderColor: copyHovered ? 'var(--teal)' : 'var(--border)',
          }}
        >
          <CopyIcon />
          Copy QASM
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          onMouseEnter={() => setDlHovered(true)}
          onMouseLeave={() => setDlHovered(false)}
          style={{
            ...btnBase,
            background: dlHovered ? 'var(--bg-hover)' : 'transparent',
            color: dlHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          <DownloadIcon />
          .qasm
        </button>

        {/* Open in TKET link */}
        <a
          href="https://tket.quantinuum.com/api-docs/index.html"
          target="_blank"
          rel="noreferrer"
          onMouseEnter={() => setTketHovered(true)}
          onMouseLeave={() => setTketHovered(false)}
          style={{
            ...btnBase,
            textDecoration: 'none',
            background: tketHovered ? 'var(--bg-hover)' : 'transparent',
            color: tketHovered ? 'var(--teal)' : 'var(--text-muted)',
            borderColor: tketHovered ? 'var(--teal)' : 'var(--border)',
          }}
        >
          <TketIcon />
          Open in TKET
        </a>
      </div>

      {/* QASM viewer */}
      <div style={{ flex: 1, overflow: 'hidden', margin: '0 16px 16px' }}>
        <QasmViewer content={qasm} />
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v9M5 8l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 13h12" strokeLinecap="round" />
    </svg>
  );
}

function TketIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 3L10 8L6 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
