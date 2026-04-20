import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { useRun } from '../hooks/useRun';
import TerminalOutput from './TerminalOutput';
import ResultsTab from './ResultsTab';
import HugrTab from './HugrTab';
import type { OutputTab, RunState } from '../../lib/types';

// Register keyboard shortcut (hook must be used in a component)
function RunShortcutRegistrar() {
  useRun();
  return null;
}

export default function OutputPane() {
  const { activeTab, setActiveTab, runState } = usePlaygroundStore();

  const statusInfo = getStatusInfo(runState);

  const tabs: { id: OutputTab; label: string }[] = [
    { id: 'output',  label: 'Output'  },
    { id: 'results', label: 'Results' },
    { id: 'hugr',    label: 'HUGR'    },
  ];

  return (
    <div style={{
      width: 'var(--output-w)', flexShrink: 0,
      display: 'flex', flexDirection: 'column', background: 'var(--bg-base)',
    }}>
      <RunShortcutRegistrar />

      {/* Tab bar */}
      <div style={{
        height: 34, background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-end',
        padding: '0 12px', flexShrink: 0,
      }}>
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeTab === 'output'  && <TerminalOutput />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'hugr'    && <HugrTab />}
      </div>

      {/* Status bar */}
      <div style={{
        height: 28, background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8, flexShrink: 0,
      }}>
        <StatusDot color={statusInfo.dotColor} pulse={statusInfo.pulse} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {statusInfo.text}
        </span>
        <div style={{ flex: 1 }} />
        {runState.status === 'success' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 34, padding: '0 12px',
        fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500,
        color: active ? 'var(--text-primary)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid var(--teal)' : '2px solid transparent',
        cursor: 'pointer', transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: '50%',
      background: color, flexShrink: 0,
      animation: pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
    }} />
  );
}

function getStatusInfo(state: RunState): { text: string; dotColor: string; pulse?: boolean } {
  switch (state.status) {
    case 'idle':           return { text: 'Ready',         dotColor: 'var(--text-muted)' };
    case 'compiling':      return { text: 'Compiling…',    dotColor: 'var(--teal)',   pulse: true };
    case 'simulating':     return { text: 'Simulating…',   dotColor: 'var(--teal)',   pulse: true };
    case 'success':        return { text: `Done · ${(state.elapsed_ms / 1000).toFixed(2)}s`, dotColor: 'var(--green)' };
    case 'compile_error':  return { text: `${state.errors.length} error${state.errors.length !== 1 ? 's' : ''}`, dotColor: 'var(--red)' };
    case 'timeout':        return { text: 'Timed out',     dotColor: 'var(--red)' };
    case 'rate_limited':   return { text: 'Rate limited',  dotColor: 'var(--yellow)' };
    case 'internal_error': return { text: 'Error',         dotColor: 'var(--red)' };
    default:               return { text: 'Ready',         dotColor: 'var(--text-muted)' };
  }
}
