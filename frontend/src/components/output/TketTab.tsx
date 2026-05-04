import React from 'react';
import { usePlaygroundStore } from '../../lib/store';

export default function TketTab() {
  const { runState } = usePlaygroundStore();

  if (runState.status !== 'success' || !runState.response.compile) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>No TKET output yet</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          Compile the program to inspect the<br />tket2 circuit representation.
        </div>
      </div>
    );
  }

  const { tket_mermaid } = runState.response.compile;

  if (!tket_mermaid) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--text-muted)', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⬡</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>TKET output unavailable</div>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          Could not convert this program to a tket2 circuit.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
      }}>
        tket2 Circuit · Mermaid
      </div>
      <pre style={{
        margin: 0, padding: 12,
        background: 'var(--bg-base)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
        fontSize: 11, lineHeight: 1.6,
        overflowX: 'auto', whiteSpace: 'pre', wordBreak: 'normal',
      }}>
        {tket_mermaid}
      </pre>
    </div>
  );
}
