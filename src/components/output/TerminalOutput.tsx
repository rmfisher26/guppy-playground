import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { RunState } from '../../lib/types';

export default function TerminalOutput() {
  const { runState } = usePlaygroundStore();
  return (
    <div style={{
      flex: 1, padding: 16, fontFamily: 'var(--font-mono)',
      fontSize: 12, lineHeight: 1.7, overflowY: 'auto',
      background: 'var(--bg-base)',
    }}>
      <TerminalContent state={runState} />
    </div>
  );
}

function TerminalContent({ state }: { state: RunState }) {
  if (state.status === 'idle') {
    return <Line color="var(--text-muted)">Press ▶ Run or Ctrl+Enter to compile and simulate</Line>;
  }

  if (state.status === 'compiling') {
    return (
      <>
        <Line color="var(--teal)">Compiling…</Line>
        <Blank />
        <Line color="var(--text-muted)">  guppylang → HUGR IR → selene-sim</Line>
        <Blank />
        <SpinnerLine label="Type checking" />
      </>
    );
  }

  if (state.status === 'simulating') {
    return (
      <>
        <Line color="var(--green)">✓ Type check passed</Line>
        <Line color="var(--green)">✓ Linearity check passed</Line>
        <Line color="var(--green)">✓ HUGR compiled</Line>
        <Blank />
        <SpinnerLine label="Running Selene…" />
      </>
    );
  }

  if (state.status === 'success') {
    const { response, elapsed_ms } = state;
    const compile = response.compile;
    return (
      <>
        <Line color="var(--text-muted)">  guppylang {compile ? `→ HUGR IR (${compile.node_count} nodes) → selene-sim` : '→ selene-sim'}</Line>
        <Blank />
        {compile?.warnings.map((w, i) => (
          <Line key={i} color="var(--yellow)">⚠ line {w.line}: {w.message}</Line>
        ))}
        <Line color="var(--green)">✓ Type check passed</Line>
        <Line color="var(--green)">✓ Linearity check passed — no qubit leaks</Line>
        {compile && <Line color="var(--green)">✓ Compiled to HUGR ({compile.node_count} nodes)</Line>}
        <Blank />
        <Line color="var(--teal)">Running {response.results ? Object.values(response.results.counts).reduce((a,b)=>a+b,0).toLocaleString() : '—'} shots…</Line>
        <Blank />
        <Line color="var(--green)">✓ Simulation complete</Line>
        <Blank />
        <Line color="var(--text-muted)">  Finished in {(elapsed_ms / 1000).toFixed(2)}s</Line>
      </>
    );
  }

  if (state.status === 'compile_error') {
    return (
      <>
        <Line color="var(--text-muted)">  guppylang → HUGR IR</Line>
        <Blank />
        {state.errors.map((err, i) => (
          <div key={i}>
            <Line color="var(--red)">✗ {err.kind}: {err.message}</Line>
            <Line color="var(--text-muted)">  → line {err.line}{err.col ? `, col ${err.col}` : ''}</Line>
          </div>
        ))}
        <Blank />
        <Line color="var(--text-muted)">  Compilation failed — check highlighted lines in editor</Line>
      </>
    );
  }

  if (state.status === 'timeout') {
    return (
      <>
        <Line color="var(--red)">✗ Simulation timed out (10s limit)</Line>
        <Line color="var(--text-muted)">  Try reducing qubit count or shot count</Line>
      </>
    );
  }

  if (state.status === 'rate_limited') {
    return (
      <Line color="var(--yellow)">
        ⚠ Rate limited — retry in {(state.retry_after_ms / 1000).toFixed(0)}s
      </Line>
    );
  }

  if (state.status === 'internal_error') {
    return (
      <>
        <Line color="var(--red)">✗ Error: {state.message}</Line>
        <Blank />
        <Line color="var(--text-muted)">  Is the backend running? docker compose up</Line>
      </>
    );
  }

  return null;
}

function Line({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 1 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, userSelect: 'none' }}>$</span>
      <span style={{ color, flex: 1 }}>{children}</span>
    </div>
  );
}

function Blank() {
  return <div style={{ height: 8 }} />;
}

function SpinnerLine({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>$</span>
      <span style={{
        width: 10, height: 10, border: '1.5px solid var(--border)',
        borderTopColor: 'var(--teal)', borderRadius: '50%',
        display: 'inline-block', animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }} />
      <span style={{ color: 'var(--teal)' }}>{label}</span>
    </div>
  );
}
