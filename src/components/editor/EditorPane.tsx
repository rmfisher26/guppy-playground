import React, { useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import GuppyEditor from './GuppyEditor';
import { useMobile } from '../../lib/useMobile';

export default function EditorPane() {
  const { activeSlot, examples, isModified, source, saveWorkspace, setActiveExample, restoreWorkspace } = usePlaygroundStore();
  const isMobile = useMobile();

  const activeExample = examples.find(e => e.id === activeSlot);

  // Derive filename
  const filename = activeSlot === 'workspace'
    ? 'main.py'
    : activeExample
      ? activeExample.id.replace(/-/g, '_') + '.py'
      : 'main.py';

  // Auto-save workspace source whenever source changes while in workspace slot
  useEffect(() => {
    if (activeSlot === 'workspace') {
      saveWorkspace();
    }
  }, [source, activeSlot]);

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

        {/* Modified dot — only show when viewing an example that's been changed */}
        {activeSlot !== 'workspace' && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--yellow)',
            opacity: isModified ? 1 : 0,
            transition: 'opacity 0.2s',
          }} />
        )}

        <div style={{ flex: 1 }} />

        {/* Examples dropdown (mobile) / slot badge (desktop) */}
        {isMobile ? (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={activeSlot}
              onChange={e => {
                const val = e.target.value;
                if (val === 'workspace') {
                  restoreWorkspace();
                } else {
                  if (activeSlot === 'workspace') saveWorkspace();
                  setActiveExample(val);
                }
              }}
              style={{
                height: 22, padding: '0 20px 0 8px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: activeSlot === 'workspace' ? 'var(--teal)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                cursor: 'pointer', appearance: 'none' as any, outline: 'none',
              }}
            >
              <option value="workspace">workspace</option>
              {examples.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.title}</option>
              ))}
            </select>
            <span style={{
              position: 'absolute', right: 6, pointerEvents: 'none',
              color: 'var(--text-muted)', fontSize: 8,
            }}>▾</span>
          </div>
        ) : (
          <span style={{
            fontSize: 10,
            color: activeSlot === 'workspace' ? 'var(--teal)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {activeSlot === 'workspace' ? 'workspace' : 'example'}
          </span>
        )}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <GuppyEditor />
      </div>
    </div>
  );
}
