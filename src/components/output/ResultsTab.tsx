import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { usePlaygroundStore } from '../../lib/store';

export default function ResultsTab() {
  const { runState } = usePlaygroundStore();

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
        <div style={{ color: 'var(--text-muted)' }}>{d.pct}%</div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <SectionTitle>Measurement Outcomes · {total.toLocaleString()} shots</SectionTitle>

      {/* Recharts bar chart */}
      <div style={{ height: Math.max(120, chartData.length * 36), marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <XAxis type="number" hide domain={[0, total]} />
            <YAxis
              type="category" dataKey="basis" width={48}
              tick={{ fill: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,180,216,0.06)' }} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={22}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#barGradient)`}
                />
              ))}
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--teal-dim)" />
                  <stop offset="100%" stopColor="var(--teal)" />
                </linearGradient>
              </defs>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
