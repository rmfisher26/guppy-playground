import React, { useState, useMemo } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { Example } from '../../lib/types';

export default function Sidebar() {
  const { examples, activeExampleId, setActiveExample, setSource, setModified } = usePlaygroundStore();
  const [query, setQuery] = useState('');

  function select(ex: Example) {
    setActiveExample(ex.id);
    setSource(ex.source);
    setModified(false);
  }

  const filtered = useMemo(() => {
    if (!query) return examples;
    const q = query.toLowerCase();
    return examples.filter(e => e.title.toLowerCase().includes(q) || e.tags.some(t => t.includes(q)));
  }, [examples, query]);

  // Group by group field
  const groups = useMemo(() => {
    const map = new Map<string, Example[]>();
    for (const ex of filtered) {
      if (!map.has(ex.group)) map.set(ex.group, []);
      map.get(ex.group)!.push(ex);
    }
    return map;
  }, [filtered]);

  return (
    <aside style={{
      width: 'var(--sidebar-w)', flexShrink: 0,
      background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        Examples
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search examples…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%', height: 26, background: 'var(--bg-base)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)', fontFamily: 'var(--font-ui)',
            fontSize: 11, padding: '0 8px', outline: 'none',
          }}
        />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {Array.from(groups.entries()).map(([group, items]) => (
          <div key={group} style={{ marginBottom: 4 }}>
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
                active={ex.id === activeExampleId}
                onClick={() => select(ex)}
              />
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function ExampleItem({ example, active, onClick }: { example: Example; active: boolean; onClick: () => void }) {
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
      {/* Active bar */}
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: 'var(--teal)', borderRadius: '0 1px 1px 0',
        }} />
      )}

      {/* Dot */}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? 'var(--teal)' : highlighted ? 'var(--text-muted)' : 'var(--border-bright)',
        transition: 'background 0.15s',
      }} />

      {/* Name */}
      <span style={{
        fontSize: 12, flex: 1,
        color: highlighted ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'color 0.1s',
      }}>
        {example.title}
      </span>

      {/* Qubit badge */}
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
