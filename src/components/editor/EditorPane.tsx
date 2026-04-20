import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import GuppyEditor from './GuppyEditor';

export default function EditorPane() {
  const { activeExampleId, examples, isModified } = usePlaygroundStore();
  const activeExample = examples.find(e => e.id === activeExampleId);
  const filename = activeExample ? activeExample.id.replace(/-/g, '_') + '.py' : 'main.py';

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      minWidth: 0, borderRight: '1px solid var(--border)',
    }}>
      {/* Pane header */}
      <div style={{
        height: 34, background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8, flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {filename}
        </span>
        {/* Modified dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--yellow)',
          opacity: isModified ? 1 : 0,
          transition: 'opacity 0.2s',
        }} />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Guppy
        </span>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <GuppyEditor />
      </div>
    </div>
  );
}
