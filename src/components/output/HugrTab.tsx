import React, { useState } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { HugrNode } from '../../lib/types';

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  DFG:     { bg: 'rgba(0,180,216,0.15)',  color: 'var(--teal)' },
  FuncDef: { bg: 'rgba(63,185,80,0.15)',  color: 'var(--green)' },
  Call:    { bg: 'rgba(210,153,34,0.15)', color: 'var(--yellow)' },
  Gate:    { bg: 'rgba(232,113,42,0.15)', color: 'var(--orange)' },
  Measure: { bg: 'rgba(248,81,73,0.15)',  color: 'var(--red)' },
  Const:   { bg: 'rgba(139,152,168,0.15)', color: 'var(--text-secondary)' },
  Input:   { bg: 'rgba(139,152,168,0.1)',  color: 'var(--text-muted)' },
  Output:  { bg: 'rgba(139,152,168,0.1)',  color: 'var(--text-muted)' },
};

export default function HugrTab() {
  const { runState } = usePlaygroundStore();
  const [jsonOpen, setJsonOpen] = useState(false);

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

  const { hugr_nodes, node_count } = runState.response.compile;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', marginBottom: 12,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-muted)', flex: 1,
        }}>
          HUGR IR · {node_count} nodes
        </span>
        <JsonToggleButton active={jsonOpen} onClick={() => setJsonOpen(o => !o)} />
      </div>

      {jsonOpen && (
        <pre style={{
          margin: '0 0 12px', padding: 12,
          background: 'var(--bg-base)', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
          fontSize: 11, lineHeight: 1.6,
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {JSON.stringify(runState, null, 2)}
        </pre>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {hugr_nodes.map((node) => (
          <HugrNodeRow key={node.id} node={node} />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)',
        display: 'flex', flexWrap: 'wrap', gap: 8,
      }}>
        {Object.entries(TYPE_STYLES).slice(0, 5).map(([type, style]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
              padding: '1px 5px', borderRadius: 3,
              background: style.bg, color: style.color,
            }}>
              {type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HugrNodeRow({ node }: { node: HugrNode }) {
  const [hovered, setHovered] = useState(false);
  const style = TYPE_STYLES[node.type] ?? TYPE_STYLES.Const;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-raised)' : 'var(--bg-surface)',
        border: `1px solid ${hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '7px 10px',
        display: 'flex', alignItems: 'center', gap: 10,
        marginLeft: node.depth * 18,
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'default',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
        letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 3,
        flexShrink: 0, background: style.bg, color: style.color,
      }}>
        {node.type}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
        {node.meta}
      </span>
    </div>
  );
}

function JsonToggleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={active ? 'Hide JSON' : 'Show run state JSON'}
      style={{
        height: 22, padding: '0 7px',
        background: active ? 'var(--teal-subtle)' : hovered ? 'var(--bg-raised)' : 'transparent',
        border: `1px solid ${active ? 'var(--teal-dim)' : hovered ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--text-teal)' : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        cursor: 'pointer', letterSpacing: '0.04em',
        transition: 'all 0.15s', flexShrink: 0,
      }}
    >
      {'{ }'}
    </button>
  );
}
