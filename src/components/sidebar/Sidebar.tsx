import React, { useState, useMemo } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { Example } from '../../lib/types';

export default function Sidebar() {
  const {
    examples, activeSlot,
    setActiveExample, setActiveSlot,
    source, workspaceSource, restoreWorkspace, saveWorkspace,
    setSource, setModified,
  } = usePlaygroundStore();

  const [query, setQuery] = useState('');

  function selectExample(ex: Example) {
    // Snapshot workspace before leaving it
    if (activeSlot === 'workspace') {
      saveWorkspace();
    }
    setActiveExample(ex.id);
  }

  function selectWorkspace() {
    if (activeSlot !== 'workspace') {
      restoreWorkspace();
    }
  }

  const filtered = useMemo(() => {
    if (!query) return examples;
    const q = query.toLowerCase();
    return examples.filter(
      e => e.title.toLowerCase().includes(q) || e.tags.some(t => t.includes(q))
    );
  }, [examples, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Example[]>();
    for (const ex of filtered) {
      if (!map.has(ex.group)) map.set(ex.group, []);
      map.get(ex.group)!.push(ex);
    }
    return map;
  }, [filtered]);

  const isWorkspaceActive = activeSlot === 'workspace';

  // Show a preview of workspace source (first non-empty, non-comment line)
  const workspacePreview = useMemo(() => {
    const lines = workspaceSource.split('\n');
    const sig = lines.find(l => l.startsWith('def ') || l.startsWith('@guppy'));
    return sig?.trim().slice(0, 28) ?? 'main.py';
  }, [workspaceSource]);

  return (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0,
      background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Workspace section ─────────────────────────────────── */}
      <div style={{
        padding: '10px 14px 6px',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        Workspace
      </div>

      <WorkspaceItem
        active={isWorkspaceActive}
        preview={workspacePreview}
        onClick={selectWorkspace}
      />

      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0', flexShrink: 0 }} />

      {/* ── Examples section ──────────────────────────────────── */}
      <div style={{
        padding: '6px 14px 4px',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        Examples
      </div>

      {/* Search */}
      <div style={{ padding: '4px 10px 6px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', height: 24, background: 'var(--bg-base)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
            fontSize: 11, padding: '0 8px', outline: 'none',
          }}
        />
      </div>

      {/* Example list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 6 }}>
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 2 }}>
            <div style={{
              padding: '4px 14px 2px', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)',
            }}>
              {group}
            </div>
            {items.map(ex => (
              <ExampleItem
                key={ex.id}
                example={ex}
                active={activeSlot === ex.id}
                onClick={() => selectExample(ex)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

// ── Workspace item ─────────────────────────────────────────────────────────

function WorkspaceItem({
  active, preview, onClick,
}: {
  active: boolean;
  preview: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 14px', cursor: 'pointer',
        gap: 8, position: 'relative', flexShrink: 0,
        background: active ? 'rgba(0,180,216,0.06)' : hovered ? 'var(--bg-raised)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: 'var(--teal)', borderRadius: '0 1px 1px 0',
        }} />
      )}

      {/* File icon */}
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--teal)' : highlighted ? 'var(--text-secondary)' : 'var(--text-muted)'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transition: 'stroke 0.15s' }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: highlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
          transition: 'color 0.1s',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          main.py
        </div>
        <div style={{
          fontSize: 10, color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginTop: 1,
        }}>
          {preview}
        </div>
      </div>

      {active && (
        <span style={{
          fontSize: 9, fontFamily: 'var(--font-mono)',
          color: 'var(--teal)', background: 'rgba(0,180,216,0.1)',
          border: '1px solid rgba(0,180,216,0.25)',
          borderRadius: 3, padding: '1px 5px', flexShrink: 0,
        }}>
          active
        </span>
      )}
    </div>
  );
}

// ── Example item ───────────────────────────────────────────────────────────

function ExampleItem({
  example, active, onClick,
}: {
  example: Example;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlighted = active || hovered;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', padding: '5px 14px',
        cursor: 'pointer', gap: 8, position: 'relative',
        background: active ? 'rgba(0,180,216,0.06)' : hovered ? 'var(--bg-raised)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: 'var(--teal)', borderRadius: '0 1px 1px 0',
        }} />
      )}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? 'var(--teal)' : highlighted ? 'var(--text-muted)' : 'var(--border-bright)',
        transition: 'background 0.15s',
      }} />
      <span style={{
        fontSize: 12, flex: 1,
        color: highlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'color 0.1s',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {example.title}
      </span>
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)', background: 'var(--bg-base)',
        border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px',
        flexShrink: 0,
      }}>
        {example.qubit_count}q
      </span>
    </div>
  );
}
