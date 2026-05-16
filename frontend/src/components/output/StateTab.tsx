import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import type { StateSnapshot, StateTracedState } from '../../lib/types';

const INV_SQRT2 = 1 / Math.sqrt(2);
const EPS = 5e-4;
const MAX_EQ_TERMS = 6;
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const toSub = (n: number) => String(n).split('').map(d => SUBSCRIPTS[+d]).join('');

export default function StateTab() {
  const { runState } = usePlaygroundStore();

  if (runState.status !== 'success') {
    return <EmptyState kind="no-run" />;
  }

  const snapshots = runState.response.results?.state_snapshots?.[0];

  if (!snapshots || snapshots.length === 0) {
    return <EmptyState kind="no-snapshots" />;
  }

  return (
    <div style={{
      flex: 1, overflow: 'auto', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {snapshots.length} state snapshot{snapshots.length !== 1 ? 's' : ''} · shot 0
        </span>
      </div>
      {snapshots.map((snap, i) => (
        <SnapshotCard key={`${snap.tag}-${i}`} snapshot={snap} index={i} />
      ))}
    </div>
  );
}

// ── Snapshot card ─────────────────────────────────────────────────────────

function SnapshotCard({ snapshot, index }: { snapshot: StateSnapshot; index: number }) {
  const { tag, specified_qubits, distribution } = snapshot;
  const n = specified_qubits.length;
  const isPure = distribution.length === 1 && Math.abs(distribution[0].probability - 1) < 1e-4;
  const basisLabel = `|${specified_qubits.map(q => `q${toSub(q)}`).join('')}⟩`;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '7px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-muted)',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 3, padding: '1px 5px', flexShrink: 0,
        }}>
          #{index + 1}
        </span>
        <code style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          color: 'var(--teal)', flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          state_result(<span style={{ color: 'var(--amber, #f59e0b)' }}>"{tag}"</span>, ···)
        </code>
        {!isPure && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 10,
            color: 'var(--amber, #f59e0b)',
            background: 'color-mix(in srgb, #f59e0b 10%, transparent)',
            border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
            borderRadius: 3, padding: '1px 5px', flexShrink: 0,
          }}>
            mixed
          </span>
        )}
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-muted)', flexShrink: 0,
        }}>
          {basisLabel}
        </span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 11,
          color: 'var(--text-muted)', flexShrink: 0,
        }}>
          {n} qubit{n !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Body */}
      {isPure
        ? <PureStateBody amplitudes={distribution[0].amplitudes} n={n} />
        : <MixedStateBody distribution={distribution} n={n} />
      }
    </div>
  );
}

// ── Pure state — equation hero + detail rows ──────────────────────────────

function PureStateBody({ amplitudes, n }: { amplitudes: [number, number][]; n: number }) {
  const probs = amplitudes.map(([re, im]) => re * re + im * im);
  const nonZeroCount = probs.filter(p => p > 1e-9).length;

  if (nonZeroCount === 0) {
    return (
      <div style={{ padding: '12px 16px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
          (all amplitudes zero)
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Zone 1: Dirac notation equation — the hero */}
      <div style={{ padding: '14px 16px 12px' }}>
        <StateEquation amplitudes={amplitudes} n={n} />
      </div>

      {/* Zone 2: Detail rows — exact amplitudes and probabilities */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        padding: '8px 12px 10px',
      }}>
        <BasisRows amplitudes={amplitudes} n={n} probs={probs} />
      </div>
    </>
  );
}

// ── Mixed state — one branch sub-card per outcome ─────────────────────────

function MixedStateBody({ distribution, n }: { distribution: StateTracedState[]; n: number }) {
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {distribution.map((branch, bi) => (
        <div key={bi} style={{
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--amber, #f59e0b)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '4px 10px',
            background: 'color-mix(in srgb, #f59e0b 6%, var(--bg-surface))',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--amber, #f59e0b)',
          }}>
            p = {(branch.probability * 100).toFixed(1)}%
          </div>
          <div style={{ padding: '10px 10px 8px' }}>
            <StateEquation amplitudes={branch.amplitudes} n={n} />
          </div>
          <div style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-raised)',
            padding: '6px 10px 8px',
          }}>
            <BasisRows
              amplitudes={branch.amplitudes}
              n={n}
              probs={branch.amplitudes.map(([re, im]) => re * re + im * im)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dirac notation equation ───────────────────────────────────────────────

function StateEquation({ amplitudes, n }: { amplitudes: [number, number][]; n: number }) {
  const terms = amplitudes
    .map(([re, im], idx) => ({ re, im, idx, prob: re * re + im * im }))
    .filter(t => t.prob > 1e-9);

  if (terms.length === 0) {
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-muted)' }}>0</span>;
  }

  const truncated = terms.length > MAX_EQ_TERMS;
  const display = truncated ? terms.slice(0, MAX_EQ_TERMS) : terms;

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 15,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      rowGap: 4,
      userSelect: 'text',
    }}>
      {display.map((term, i) => {
        const { sign, coeff } = termDisplay(term.re, term.im);
        const ket = term.idx.toString(2).padStart(n, '0');
        return (
          <React.Fragment key={term.idx}>
            {i === 0 && sign === '-' && (
              <span style={{ color: 'var(--text-muted)', marginRight: 2 }}>−</span>
            )}
            {i > 0 && (
              <span style={{ color: 'var(--text-muted)', margin: '0 5px' }}>
                {sign === '-' ? '−' : '+'}
              </span>
            )}
            {coeff && (
              <span style={{ color: 'var(--text-secondary)', marginRight: 2 }}>{coeff}</span>
            )}
            <span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--teal)', letterSpacing: '0.04em' }}>{ket}</span>
              <span style={{ color: 'var(--text-muted)' }}>⟩</span>
            </span>
          </React.Fragment>
        );
      })}
      {truncated && (
        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: 13 }}>
          + {terms.length - MAX_EQ_TERMS} more…
        </span>
      )}
    </div>
  );
}

// ── Detail rows ───────────────────────────────────────────────────────────

function BasisRows({
  amplitudes, n, probs,
}: {
  amplitudes: [number, number][]; n: number; probs: number[];
}) {
  const maxProb = Math.max(...probs, 1e-12);
  const nonZeroCount = probs.filter(p => p > 1e-9).length;
  const showAll = (1 << n) <= 8;

  const rows = amplitudes
    .map(([re, im], idx) => ({ re, im, idx, prob: probs[idx] }))
    .filter(r => showAll || r.prob > 1e-9);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map(({ re, im, idx, prob }) => (
        <BasisRow
          key={idx}
          basis={idx.toString(2).padStart(n, '0')}
          prob={prob}
          maxProb={maxProb}
          re={re}
          im={im}
          dim={prob < 1e-9}
        />
      ))}
      {!showAll && nonZeroCount < amplitudes.length && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', paddingTop: 2 }}>
          {amplitudes.length - nonZeroCount} zero-amplitude basis state{amplitudes.length - nonZeroCount !== 1 ? 's' : ''} hidden
        </span>
      )}
    </div>
  );
}

// ── Single basis-state row ────────────────────────────────────────────────

function BasisRow({
  basis, prob, maxProb, re, im, dim,
}: {
  basis: string; prob: number; maxProb: number; re: number; im: number; dim: boolean;
}) {
  const pct = (prob / maxProb) * 100;
  const label = formatAmplitude(re, im);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto auto',
      alignItems: 'center',
      gap: 8,
      opacity: dim ? 0.25 : 1,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 12,
        color: 'var(--text-secondary)',
        letterSpacing: '0.02em',
        userSelect: 'none',
      }}>
        |{basis}⟩
      </span>
      <div style={{ height: 14, background: 'var(--bg-base, var(--bg-raised))', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'var(--teal)', opacity: 0.75,
          transition: 'width 0.2s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: prob > 1e-9 ? 'var(--text-secondary)' : 'var(--text-muted)',
        minWidth: 38, textAlign: 'right',
      }}>
        {(prob * 100).toFixed(1)}%
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: 'var(--text-muted)',
        minWidth: 100, textAlign: 'right',
        opacity: prob > 1e-9 ? 1 : 0.4,
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Term display helpers ──────────────────────────────────────────────────

interface TermDisplay { sign: '+' | '-'; coeff: string }

function termDisplay(re: number, im: number): TermDisplay {
  const isReZero = Math.abs(re) < EPS;
  const isImZero = Math.abs(im) < EPS;

  if (!isReZero && isImZero) {
    return { sign: re < 0 ? '-' : '+', coeff: realMagSymbol(Math.abs(re)) };
  }
  if (isReZero && !isImZero) {
    const mag = realMagSymbol(Math.abs(im));
    return { sign: im < 0 ? '-' : '+', coeff: mag ? `${mag}i` : 'i' };
  }
  // General complex: embed sign inside the parenthesised form
  const imSign = im < 0 ? ' − ' : ' + ';
  return { sign: '+', coeff: `(${fmtN(re)}${imSign}${fmtN(Math.abs(im))}i)` };
}

function realMagSymbol(abs: number): string {
  if (Math.abs(abs - 1) < EPS)                      return '';       // omit — coefficient is 1
  if (Math.abs(abs - INV_SQRT2) < EPS)              return '1/√2';
  if (Math.abs(abs - 0.5) < EPS)                    return '1/2';
  if (Math.abs(abs - Math.sqrt(3) / 2) < EPS)       return '√3/2';
  if (Math.abs(abs - 1 / Math.sqrt(3)) < EPS)       return '1/√3';
  return fmtN(abs);
}

function formatAmplitude(re: number, im: number): string {
  const reNear = Math.abs(re) < EPS;
  const imNear = Math.abs(im) < EPS;
  if (reNear && imNear) return '0';
  if (reNear) {
    const mag = realMagSymbol(Math.abs(im)) || '1';
    return im < 0 ? `−${mag}i` : `${mag}i`;
  }
  if (imNear) {
    const mag = realMagSymbol(Math.abs(re)) || '1';
    return re < 0 ? `−${mag}` : mag;
  }
  // General complex: fall back to decimal
  const sign = im < 0 ? ' − ' : ' + ';
  return `${fmtN(re)}${sign}${fmtN(Math.abs(im))}i`;
}

function fmtN(v: number): string {
  return v.toFixed(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// ── Empty states ──────────────────────────────────────────────────────────

function EmptyState({ kind }: { kind: 'no-run' | 'no-snapshots' }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, gap: 16, textAlign: 'center',
    }}>
      <WaveIcon />
      {kind === 'no-run' ? (
        <>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Quantum state debugger
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
            Run a program that calls <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>state_result()</code> to
            snapshot intermediate quantum state at any point during execution.
          </span>
          <CodeHint />
        </>
      ) : (
        <>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            No state snapshots
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
            Add <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)' }}>state_result("label", q)</code> calls
            to your program to inspect the quantum state at any point.
          </span>
          <CodeHint />
        </>
      )}
    </div>
  );
}

function CodeHint() {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      textAlign: 'left',
      maxWidth: 340,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7, color: 'var(--text-muted)' }}>
        <span style={{ opacity: 0.5 }}>from </span>
        <span style={{ color: 'var(--text-secondary)' }}>guppylang.std.debug</span>
        <span style={{ opacity: 0.5 }}> import </span>
        <span style={{ color: 'var(--teal)' }}>state_result</span>
        <br />
        <span style={{ opacity: 0.5 }}>{'···'}</span>
        <br />
        <span style={{ color: 'var(--teal)' }}>state_result</span>
        <span style={{ color: 'var(--text-secondary)' }}>(</span>
        <span style={{ color: 'var(--amber, #f59e0b)' }}>"after_h"</span>
        <span style={{ color: 'var(--text-secondary)' }}>, q)</span>
        <span style={{ opacity: 0.5 }}>  # snapshots |+⟩</span>
      </div>
    </div>
  );
}

function WaveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 12 Q4 6 6 12 Q8 18 10 12 Q12 6 14 12 Q16 18 18 12 Q20 6 22 12" />
    </svg>
  );
}
