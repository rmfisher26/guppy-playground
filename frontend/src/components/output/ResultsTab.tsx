import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { usePlaygroundStore, resolveIsDark } from '../../lib/store';

const IDEAL_COLOR = 'var(--teal)';
const NOISY_COLOR = '#f59e0b';

export default function ResultsTab() {
  const { runState, theme } = usePlaygroundStore();
  const isDark = resolveIsDark(theme);
  const basisTickColor = isDark ? 'var(--text-primary)' : 'var(--text-secondary)';
  const [chartLayout, setChartLayout] = useState<'vertical' | 'horizontal'>('vertical');

  if (runState.status !== 'success' || !runState.response.results) {
    return (
      <EmptyState
        icon="◈"
        title="No results yet"
        desc={<>Run the program to see simulation results.<br /><br /><Kbd>Ctrl+Enter</Kbd></>}
      />
    );
  }

  const { counts, noisy_counts, register_names, expectation_values, simulate_time_ms } = runState.response.results;
  const hasRegNames = register_names != null && register_names.length > 0;

  function expandBits(bits: string): string | null {
    if (!hasRegNames || register_names!.length !== bits.length) return null;
    const arrayPat = /^(.+)\[(\d+)\]$/;
    const groups = new Map<string, string[]>();
    let allArray = true;
    for (let i = 0; i < register_names!.length; i++) {
      const m = register_names![i].match(arrayPat);
      if (!m) { allArray = false; break; }
      const base = m[1];
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(bits[i]);
    }
    if (allArray && groups.size > 0) {
      return Array.from(groups.entries()).map(([base, bs]) => `${base}=${bs.join('')}`).join(', ');
    }
    return register_names!.map((name: string, i: number) => `${name}=${bits[i]}`).join(', ');
  }

  const qubit_count = runState.response.compile?.qubit_count;
  const hasNoise = noisy_counts != null && Object.keys(noisy_counts).length > 0;

  // Union of all basis states across both result sets
  const allBases = Array.from(
    new Set([...Object.keys(counts), ...(hasNoise ? Object.keys(noisy_counts!) : [])])
  ).sort();

  const totalIdeal = allBases.reduce((s, b) => s + (counts[b] ?? 0), 0);
  const totalNoisy = hasNoise
    ? allBases.reduce((s, b) => s + (noisy_counts![b] ?? 0), 0)
    : 0;

  const chartData = allBases.map(basis => ({
    basis: `|${basis}⟩`,
    ideal: counts[basis] ?? 0,
    noisy: hasNoise ? (noisy_counts![basis] ?? 0) : undefined,
    idealPct: totalIdeal > 0 ? (((counts[basis] ?? 0) / totalIdeal) * 100).toFixed(1) : '0.0',
    noisyPct: hasNoise && totalNoisy > 0
      ? ((((noisy_counts![basis] ?? 0) / totalNoisy) * 100).toFixed(1))
      : undefined,
  }));

  // Sort descending by ideal count
  chartData.sort((a, b) => b.ideal - a.ideal);

  const dominantEntry = chartData[0];
  const total = totalIdeal;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)', padding: '8px 12px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        <div style={{ color: 'var(--text-primary)', marginBottom: 4 }}>{d.basis}</div>
        <div style={{ color: IDEAL_COLOR }}>Ideal: {d.ideal.toLocaleString()} · {d.idealPct}%</div>
        {hasNoise && (
          <div style={{ color: NOISY_COLOR, marginTop: 2 }}>
            Noisy: {(d.noisy ?? 0).toLocaleString()} · {d.noisyPct ?? '0.0'}%
          </div>
        )}
      </div>
    );
  };

  const axisTickFormatter = (value: string) => {
    const raw = value.replace(/[|⟩]/g, '');
    return expandBits(raw) ?? value;
  };

  const yAxisWidth = (() => {
    if (!hasRegNames) return 48;
    const maxLen = Math.max(...allBases.map(b => (expandBits(b) ?? `|${b}⟩`).length));
    return Math.min(Math.max(maxLen * 6.6, 60), 200);
  })();

  const barRadius: [number, number, number, number] =
    chartLayout === 'vertical' ? [0, 3, 3, 0] : [3, 3, 0, 0];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Measurement Outcomes · {total.toLocaleString()} shots
          {hasNoise && <span style={{ color: NOISY_COLOR, marginLeft: 8 }}>· Noise comparison</span>}
        </div>
        <button
          onClick={() => setChartLayout(l => l === 'vertical' ? 'horizontal' : 'vertical')}
          title={chartLayout === 'vertical' ? 'Switch to vertical bars' : 'Switch to horizontal bars'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            height: 22, padding: '0 8px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-raised)',
            cursor: 'pointer', color: 'var(--text-muted)',
            fontFamily: 'var(--font-ui)', fontSize: 10,
          }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border-bright)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'var(--border)'; }}
        >
          {chartLayout === 'vertical' ? <HorizBarsIcon /> : <VertBarsIcon />}
          {chartLayout === 'vertical' ? 'Vertical' : 'Horizontal'}
        </button>
      </div>

      {/* Chart */}
      {chartLayout === 'vertical' ? (
        <div style={{ height: Math.max(180, chartData.length * (hasNoise ? 60 : 48)), marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: hasNoise ? 8 : 80, top: 4, bottom: 4 }} barCategoryGap="30%">
              <XAxis type="number" hide domain={[0, Math.max(totalIdeal, totalNoisy || 0)]} />
              <YAxis
                type="category" dataKey="basis" width={yAxisWidth}
                tickFormatter={axisTickFormatter}
                tick={{ fill: basisTickColor, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--teal-subtle)' }} />
              {hasNoise && (
                <Legend
                  wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10, paddingTop: 4 }}
                  formatter={(value) => (
                    <span style={{ color: value === 'ideal' ? IDEAL_COLOR : NOISY_COLOR }}>
                      {value === 'ideal' ? 'Ideal' : 'Noisy'}
                    </span>
                  )}
                />
              )}
              <Bar dataKey="ideal" fill={IDEAL_COLOR} radius={barRadius} maxBarSize={22}
                label={hasNoise ? undefined : ({ x, y, width, height, value, index }: any) => {
                  const pct = chartData[index]?.idealPct;
                  return (
                    <text x={x + width + 6} y={y + height / 2}
                      dominantBaseline="middle" textAnchor="start"
                      fontFamily="var(--font-mono)" fontSize={10}
                    >
                      <tspan fill={IDEAL_COLOR}>{value.toLocaleString()}</tspan>
                      <tspan fill="var(--text-primary)"> · {pct}%</tspan>
                    </text>
                  );
                }}
              />
              {hasNoise && (
                <Bar dataKey="noisy" fill={NOISY_COLOR} radius={barRadius} maxBarSize={22} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: Math.max(160, 120 + chartData.length * 8), marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="horizontal" margin={{ left: 8, right: 8, top: hasNoise ? 8 : 36, bottom: 4 }} barCategoryGap="25%">
              <XAxis
                type="category" dataKey="basis"
                tickFormatter={axisTickFormatter}
                tick={{ fill: basisTickColor, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis type="number" hide domain={[0, Math.max(totalIdeal, totalNoisy || 0)]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--teal-subtle)' }} />
              {hasNoise && (
                <Legend
                  wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10, paddingBottom: 4 }}
                  formatter={(value) => (
                    <span style={{ color: value === 'ideal' ? IDEAL_COLOR : NOISY_COLOR }}>
                      {value === 'ideal' ? 'Ideal' : 'Noisy'}
                    </span>
                  )}
                />
              )}
              <Bar dataKey="ideal" fill={IDEAL_COLOR} radius={barRadius} maxBarSize={40}
                label={hasNoise ? undefined : ({ x, y, width, value, index }: any) => {
                  const pct = chartData[index]?.idealPct;
                  const cx = x + width / 2;
                  return (
                    <text x={cx} y={y - 18}
                      dominantBaseline="auto" textAnchor="middle"
                      fontFamily="var(--font-mono)" fontSize={10}
                    >
                      <tspan x={cx} dy="0" fill="var(--text-primary)">{pct}%</tspan>
                      <tspan x={cx} dy="13" fill={IDEAL_COLOR}>{value.toLocaleString()}</tspan>
                    </text>
                  );
                }}
              />
              {hasNoise && (
                <Bar dataKey="noisy" fill={NOISY_COLOR} radius={barRadius} maxBarSize={40} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Noise delta table — shown only when noisy results exist */}
      {hasNoise && (
        <>
          <SectionTitle>Ideal vs Noisy</SectionTitle>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '2px 0',
            marginBottom: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            {/* Header */}
            {['State', 'Ideal', 'Noisy', 'Δ'].map(h => (
              <div key={h} style={{ color: 'var(--text-muted)', padding: '2px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
            {chartData.map(({ basis, idealPct, noisyPct }) => {
              const delta = parseFloat(noisyPct ?? '0') - parseFloat(idealPct);
              const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
              const deltaColor = Math.abs(delta) < 0.5
                ? 'var(--text-muted)'
                : delta > 0 ? NOISY_COLOR : 'var(--teal)';
              const rawBits = basis.replace(/[|⟩]/g, '');
              const expanded = expandBits(rawBits);
              return (
                <React.Fragment key={basis}>
                  <div style={{ color: 'var(--text-primary)', padding: '3px 6px' }}>
                    {expanded ?? basis}
                  </div>
                  <div style={{ color: IDEAL_COLOR, padding: '3px 6px' }}>{idealPct}%</div>
                  <div style={{ color: NOISY_COLOR, padding: '3px 6px' }}>{noisyPct ?? '0.0'}%</div>
                  <div style={{ color: deltaColor, padding: '3px 6px' }}>{deltaStr}</div>
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {/* Expectation values */}
      {expectation_values && Object.keys(expectation_values).length > 0 && (
        <>
          <SectionTitle>Expectation Values</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {Object.entries(expectation_values).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--text-secondary)' }}>⟨{key}⟩</span>
                <span style={{ color: 'var(--text-primary)' }}>{val.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Meta cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Total shots',  value: total.toLocaleString() },
          { label: 'Outcomes',     value: String(chartData.length) },
          { label: 'Most likely',  value: `${dominantEntry.basis} · ${dominantEntry.idealPct}%` },
          { label: 'Sim time',     value: `${simulate_time_ms}ms` },
          ...(qubit_count != null ? [{ label: 'Qubits', value: String(qubit_count) }] : []),
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              {label}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, opacity: 0.3 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{title}</div>
      <div style={{ fontSize: 11, lineHeight: 1.7 }}>{desc}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 4, padding: '2px 7px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)',
    }}>
      {children}
    </span>
  );
}

function HorizBarsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="4" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>
      <rect x="2" y="10" width="16" height="4" rx="1" fill="currentColor" stroke="none"/>
      <rect x="2" y="16" width="7" height="4" rx="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function VertBarsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="10" width="4" height="12" rx="1" fill="currentColor" stroke="none"/>
      <rect x="10" y="4" width="4" height="18" rx="1" fill="currentColor" stroke="none"/>
      <rect x="18" y="14" width="4" height="8" rx="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
