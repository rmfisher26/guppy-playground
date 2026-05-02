import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlaygroundStore, resolveIsDark } from '../../lib/store';

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

  const { counts, expectation_values, simulate_time_ms } = runState.response.results;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const chartData = entries.map(([basis, count]) => ({
    basis: `|${basis}⟩`,
    count,
    pct: ((count / total) * 100).toFixed(1),
  }));

  const entropy = -entries.reduce((acc, [, v]) => {
    const p = v / total;
    return acc + (p > 0 ? p * Math.log2(p) : 0);
  }, 0).toFixed(3);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)', padding: '8px 12px',
        fontFamily: 'var(--font-mono)', fontSize: 11,
      }}>
        <div style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{d.basis}</div>
        <div style={{ color: 'var(--teal)' }}>{d.count.toLocaleString()} shots</div>
        <div style={{ color: 'var(--text-primary)' }}>{d.pct}%</div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      {/* Section header with orientation toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          Measurement Outcomes · {total.toLocaleString()} shots
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

      {/* Recharts bar chart */}
      {chartLayout === 'vertical' ? (
        <div style={{ height: Math.max(120, chartData.length * 36), marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
              <XAxis type="number" hide domain={[0, total]} />
              <YAxis
                type="category" dataKey="basis" width={48}
                tick={{ fill: basisTickColor, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--teal-subtle)' }} />
              <Bar dataKey="count" fill="var(--teal)" radius={[0, 3, 3, 0]} maxBarSize={22}
                label={({ x, y, width, height, value, index }: any) => {
                  const pct = chartData[index]?.pct;
                  return (
                    <text x={x + width + 6} y={y + height / 2}
                      dominantBaseline="middle" textAnchor="start"
                      fontFamily="var(--font-mono)" fontSize={10}
                    >
                      <tspan fill="var(--teal)">{value.toLocaleString()}</tspan>
                      <tspan fill="var(--text-primary)"> · {pct}%</tspan>
                    </text>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: Math.max(160, 120 + chartData.length * 8), marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="horizontal" margin={{ left: 8, right: 8, top: 36, bottom: 4 }}>
              <XAxis
                type="category" dataKey="basis" width={48}
                tick={{ fill: basisTickColor, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis type="number" hide domain={[0, total]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--teal-subtle)' }} />
              <Bar dataKey="count" fill="var(--teal)" radius={[3, 3, 0, 0]} maxBarSize={40}
                label={({ x, y, width, value, index }: any) => {
                  const pct = chartData[index]?.pct;
                  const cx = x + width / 2;
                  return (
                    <text x={cx} y={y - 18}
                      dominantBaseline="auto" textAnchor="middle"
                      fontFamily="var(--font-mono)" fontSize={10}
                    >
                      <tspan x={cx} dy="0" fill="var(--text-primary)">{pct}%</tspan>
                      <tspan x={cx} dy="13" fill="var(--teal)">{value.toLocaleString()}</tspan>
                    </text>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
          { label: 'Entropy',      value: `${entropy} bits` },
          { label: 'Outcomes',     value: String(entries.length) },
          { label: 'Sim time',     value: `${simulate_time_ms}ms` },
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
