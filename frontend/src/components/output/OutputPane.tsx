import React, { useRef, useState, useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { useRun } from '../hooks/useRun';
import TerminalOutput from './TerminalOutput';
import ResultsTab from './ResultsTab';
import HugrTab from './HugrTab';
import TketTab from './TketTab';
import type { OutputTab, RunState } from '../../lib/types';

const OUTPUT_PANEL_MIN = 80;
const OUTPUT_PANEL_MAX_MARGIN = 80;

function RunShortcutRegistrar() {
  useRun();
  return null;
}

export default function OutputPane({ isMobile = false }: { isMobile?: boolean }) {
  const { activeTab, setActiveTab, runState, runId } = usePlaygroundStore();
  const statusInfo = getStatusInfo(runState);

  // Desktop: resizable output panel height at the bottom
  const [outputPanelHeight, setOutputPanelHeight] = useState(200);
  const [splitDividerActive, setSplitDividerActive] = useState(false);
  const [splitDividerHovered, setSplitDividerHovered] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const splitDragging = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !paneRef.current) return;
      const rect = paneRef.current.getBoundingClientRect();
      const newH = rect.bottom - e.clientY - 28; // 28 = status bar height
      setOutputPanelHeight(
        Math.max(OUTPUT_PANEL_MIN, Math.min(newH, rect.height - OUTPUT_PANEL_MAX_MARGIN - 34 - 28))
      );
    };
    const onMouseUp = () => {
      if (!splitDragging.current) return;
      splitDragging.current = false;
      setSplitDividerActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function onSplitDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    splitDragging.current = true;
    setSplitDividerActive(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

  // Mobile: 3 tabs as before
  if (isMobile) {
    const allTabs: { id: OutputTab; label: string }[] = [
      { id: 'output',  label: 'Output'  },
      { id: 'results', label: 'Results' },
      { id: 'hugr',    label: 'HUGR'    },
      { id: 'tket',    label: 'TKET'    },
    ];
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-base)',
      }}>
        <RunShortcutRegistrar />
        <div style={{
          height: 34, background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-end',
          padding: '0 12px', flexShrink: 0,
        }}>
          {allTabs.map(tab => (
            <TabButton
              key={tab.id}
              label={tab.label}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeTab === 'output'  && <TerminalOutput />}
          {activeTab === 'results' && <ResultsTab />}
          {activeTab === 'hugr'    && <HugrTab key={runId} />}
          {activeTab === 'tket'    && <TketTab key={runId} />}
        </div>
        <StatusBar statusInfo={statusInfo} runState={runState} />
      </div>
    );
  }

  // Desktop: Results/HUGR tabs on top, Output panel fixed at bottom
  const topTabs: { id: OutputTab; label: string }[] = [
    { id: 'results', label: 'Results' },
    { id: 'hugr',    label: 'HUGR'    },
    { id: 'tket',    label: 'TKET'    },
  ];
  // If activeTab is 'output' (e.g. switched from mobile), treat 'results' as selected
  const topActiveTab: OutputTab = activeTab === 'output' ? 'results' : activeTab;

  const splitHighlighted = splitDividerActive || splitDividerHovered;

  return (
    <div ref={paneRef} style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', background: 'var(--bg-base)',
    }}>
      <RunShortcutRegistrar />

      {/* Top: Results / HUGR tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <div style={{
          height: 34, background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-end',
          padding: '0 12px', flexShrink: 0,
        }}>
          {topTabs.map(tab => (
            <TabButton
              key={tab.id}
              label={tab.label}
              active={topActiveTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {topActiveTab === 'results' && <ResultsTab />}
          {topActiveTab === 'hugr'    && <HugrTab key={runId} />}
          {topActiveTab === 'tket'    && <TketTab key={runId} />}
        </div>
      </div>

      {/* Horizontal resize divider */}
      <div
        onMouseDown={onSplitDividerMouseDown}
        onMouseEnter={() => setSplitDividerHovered(true)}
        onMouseLeave={() => setSplitDividerHovered(false)}
        style={{
          height: 5, flexShrink: 0, cursor: 'row-resize', zIndex: 10,
          background: splitHighlighted ? 'var(--teal)' : 'var(--border)',
          transition: splitDividerActive ? 'none' : 'background 0.15s',
        }}
      />

      {/* Bottom: Output panel */}
      <div style={{
        height: outputPanelHeight, flexShrink: 0,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          height: 34, background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-end',
          padding: '0 12px', flexShrink: 0,
        }}>
          <TabButton label="Output" active={false} onClick={() => {}} asLabel />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TerminalOutput />
        </div>
      </div>

      <StatusBar statusInfo={statusInfo} runState={runState} />
    </div>
  );
}

function TabButton({
  label, active, onClick, asLabel,
}: {
  label: string; active: boolean; onClick: () => void; asLabel?: boolean;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 34, padding: '0 12px',
        fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 500,
        color: asLabel
          ? 'var(--text-secondary)'
          : active
          ? 'var(--text-primary)'
          : hovered
          ? 'var(--text-secondary)'
          : 'var(--text-muted)',
        background: 'transparent', border: 'none',
        borderBottom: active ? '2px solid var(--teal)' : '2px solid transparent',
        cursor: asLabel ? 'default' : 'pointer',
        transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function StatusBar({ statusInfo, runState }: { statusInfo: ReturnType<typeof getStatusInfo>; runState: RunState }) {
  return (
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
      <a
        href="https://github.com/Quantinuum/guppylang"
        target="_blank"
        rel="noreferrer"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', borderLeft: '1px solid var(--border)', paddingLeft: 8, textDecoration: 'none', opacity: 0.8 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
      >
        guppylang 0.21.11
      </a>
    </div>
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
