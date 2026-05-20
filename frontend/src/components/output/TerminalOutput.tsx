import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { RunState } from '../../lib/types';

export default function TerminalOutput() {
  const { runState, simulator, source } = usePlaygroundStore();
  return (
    <div style={{
      flex: 1, padding: 16, fontFamily: 'var(--font-mono)',
      fontSize: 12, lineHeight: 1.7, overflowY: 'auto',
      background: '#0d1117',
      // Pin CSS variables to dark-terminal values so light theme doesn't break visibility
      '--text-primary':   '#e6edf3',
      '--text-secondary': '#e6edf3',
      '--text-muted':     '#6e7681',
      '--border':         '#30363d',
    } as React.CSSProperties}>
      <TerminalContent state={runState} simulator={simulator} source={source} />
    </div>
  );
}

function TerminalContent({ state, simulator, source }: { state: RunState; simulator: 'stabilizer' | 'statevector'; source: string }) {
  // For a completed run, use the simulator that produced the results — not the currently-selected one.
  const effectiveSim = state.status === 'success' ? state.simulator : simulator;
  const simLabel = effectiveSim === 'statevector' ? 'Statevector' : 'Stabilizer';
  // True when state_result() caused the simulator to be promoted to Statevector automatically
  const autoStatevector = state.status === 'success'
    && state.simulator === 'statevector'
    && /\bstate_result\s*\(/.test(source);

  if (state.status === 'idle') {
    return <Line color="var(--text-muted)">Press ▶ Run or Ctrl+Enter to compile and simulate</Line>;
  }

  if (state.status === 'compiling') {
    return (
      <>
        <Line color="var(--teal)">Compiling…</Line>
        <Blank />
        <Line color="var(--text-muted)">  guppylang → HUGR IR → selene-sim [{simLabel}]</Line>
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
        <SpinnerLine label={`Running Selene [${simLabel}]…`} />
      </>
    );
  }

  if (state.status === 'success') {
    const { response, elapsed_ms } = state;
    const compile = response.compile;
    const isCompileOnly = !response.results;
    const shotCount = response.results
      ? Object.values(response.results.counts).reduce((a, b) => a + b, 0).toLocaleString()
      : '—';
    return (
      <>
        <Line color="var(--text-muted)">  guppylang {compile ? `→ HUGR IR (${compile.node_count} nodes)${isCompileOnly ? '' : ' → selene-sim'}` : '→ selene-sim'} {isCompileOnly ? '' : `[${simLabel}]`}</Line>
        {autoStatevector && (
          <Line color="var(--teal)">  ℹ state_result() detected — Statevector enabled automatically</Line>
        )}
        <Blank />
        {compile?.warnings.map((w, i) => (
          <Line key={i} color="var(--yellow)">⚠ line {w.line}: {w.message}</Line>
        ))}
        <Line color="var(--green)">✓ Type check passed</Line>
        <Line color="var(--green)">✓ Linearity check passed — no qubit leaks</Line>
        {compile && <Line color="var(--green)">✓ Compiled to HUGR ({compile.node_count} nodes)</Line>}
        {response.stdout && (
          <>
            <Blank />
            <StdoutBlock text={response.stdout} />
          </>
        )}
        {!isCompileOnly && (
          <>
            <Blank />
            <Line color="var(--teal)">Running {shotCount} shots · {simLabel}…</Line>
            <Blank />
            <Line color="var(--green)">✓ Simulation complete</Line>
          </>
        )}
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
        {state.stdout && (
          <>
            <StdoutBlock text={state.stdout} />
            <Blank />
          </>
        )}
        {state.errors.map((err, i) => (
          <PrettyError key={i} message={err.message} />
        ))}
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

// ── StdoutBlock ────────────────────────────────────────────────────────────
// Displays captured print() output from the user's program.
function StdoutBlock({ text }: { text: string }) {
  const lines = text.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[i] !== '');
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7 }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 1 }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, userSelect: 'none' }}>{'>'}</span>
          <span style={{ color: 'var(--text-primary)', flex: 1, whiteSpace: 'pre' }}>{line || ' '}</span>
        </div>
      ))}
    </div>
  );
}

// ── PrettyError ────────────────────────────────────────────────────────────
// Renders the multi-line pretty-printed guppylang error output.
// Each line gets coloured based on its role in the error display.
function PrettyError({ message }: { message: string }) {
  const lines = message.split('\n');

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        // "Error: ..." header line
        if (line.startsWith('Error:')) {
          return (
            <div key={i} style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>
              {line.replace('$FILE', 'your_program.py')}
            </div>
          );
        }
        // Pointer line with carets "  |   ^^^"
        if (/^\s+\|\s+\^/.test(line)) {
          const [pipe, ...rest] = line.split('|');
          const annotation = rest.join('|');
          // Split carets from label text
          const caretMatch = annotation.match(/^(\s*)(\^+)(.*)/);
          if (caretMatch) {
            return (
              <div key={i} style={{ display: 'flex', color: 'var(--text-muted)' }}>
                <span style={{ whiteSpace: 'pre' }}>{pipe}|</span>
                <span style={{ whiteSpace: 'pre', color: 'var(--yellow)' }}>
                  {caretMatch[1]}{caretMatch[2]}
                </span>
                <span style={{ color: 'var(--yellow)' }}>{caretMatch[3]}</span>
              </div>
            );
          }
        }
        // Gutter line "  |" or "N |"
        if (/^\s*\d*\s*\|/.test(line)) {
          const pipeIdx = line.indexOf('|');
          const gutter  = line.slice(0, pipeIdx + 1);
          const code    = line.slice(pipeIdx + 1);
          return (
            <div key={i} style={{ display: 'flex' }}>
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'pre', userSelect: 'none' }}>
                {gutter}
              </span>
              <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre' }}>{code}</span>
            </div>
          );
        }
        // "Guppy compilation failed" footer
        if (line.startsWith('Guppy compilation')) {
          return (
            <div key={i} style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              {line}
            </div>
          );
        }
        // Empty / separator lines
        return (
          <div key={i} style={{ color: 'var(--text-muted)', whiteSpace: 'pre' }}>
            {line || '\u00a0'}
          </div>
        );
      })}
    </div>
  );
}

