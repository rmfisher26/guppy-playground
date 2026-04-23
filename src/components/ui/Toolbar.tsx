import React from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { useRun } from '../hooks/useRun';
import { encodeShareUrl } from '../../lib/api';

export default function Toolbar() {
  const { shots, setShots, simulator, setSimulator, runState, examples, activeSlot, activeExampleId, setActiveExample, showToast } = usePlaygroundStore();
  const { run } = useRun();
  const isRunning = runState.status === 'compiling' || runState.status === 'simulating';

  function handleExampleChange(id: string) {
    const ex = examples.find(e => e.id === id);
    if (!ex) return;
    setActiveExample(id);
    setSource(ex.source);
    setModified(false);
  }

  function handleShare() {
    const source = usePlaygroundStore.getState().source;
    const url = encodeShareUrl(source);
    navigator.clipboard.writeText(url).catch(() => {});
    showToast('Link copied to clipboard');
    setTimeout(() => usePlaygroundStore.getState().hideToast(), 2200);
  }

  const btnBase: React.CSSProperties = {
    height: 28, padding: '0 12px', borderRadius: 'var(--radius-sm)',
    border: 'none', fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  };

  const selectStyle: React.CSSProperties = {
    height: 28, padding: '0 28px 0 10px', background: 'var(--bg-raised)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontSize: 12,
    cursor: 'pointer', appearance: 'none' as any, outline: 'none',
  };

  return (
    <div style={{
      height: 'var(--toolbar-h)', background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)', display: 'flex',
      alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0,
    }}>
      {/* Run button */}
      <button
        style={{
          ...btnBase,
          background: isRunning ? 'var(--teal-dim)' : 'var(--teal)',
          color: 'var(--navy)', fontWeight: 600, padding: '0 16px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          opacity: isRunning ? 0.85 : 1,
        }}
        onClick={() => !isRunning && run()}
        title="Run (Ctrl+Enter)"
      >
        {isRunning
          ? <><Spinner /> Running…</>
          : <><PlayIcon /> Run</>
        }
      </button>

      <Sep />

      {/* Example picker */}
      <SelectWrap>
        <select
          style={{
            ...selectStyle,
            color: activeSlot !== 'workspace' ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}
          value={activeSlot === 'workspace' ? '' : activeExampleId}
          onChange={e => handleExampleChange(e.target.value)}
        >
          <option value="">— examples —</option>
          {examples.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.title}</option>
          ))}
        </select>
        <Chevron />
      </SelectWrap>

      <Sep />

      {/* Simulator */}
      <SelectWrap>
        <select style={selectStyle} value={simulator} onChange={e => setSimulator(e.target.value as any)}>
          <option value="stabilizer">Stabilizer (Stim)</option>
          <option value="statevector">Statevector (QuEST)</option>
        </select>
        <Chevron />
      </SelectWrap>

      {/* Shots */}
      <SelectWrap>
        <select style={selectStyle} value={shots} onChange={e => setShots(Number(e.target.value))}>
          <option value={256}>256 shots</option>
          <option value={1024}>1024 shots</option>
          <option value={4096}>4096 shots</option>
          <option value={8192}>8192 shots</option>
        </select>
        <Chevron />
      </SelectWrap>

      <div style={{ flex: 1 }} />

      {/* Share */}
      <button
        style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }}
        onClick={handleShare}
        title="Copy share link"
        onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-raised)'; }}
        onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'transparent'; el.style.background = 'transparent'; }}
      >
        <ShareIcon /> Share
      </button>

      {/* Version badge */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
        background: 'var(--bg-base)', border: '1px solid var(--border)',
        borderRadius: 100, padding: '2px 8px',
      }}>
        guppylang 0.21.11
      </span>
    </div>
  );
}

function Sep() {
  return <div style={{ width:1, height:18, background:'var(--border)', margin:'0 2px', flexShrink:0 }} />;
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return <div style={{ position:'relative', display:'flex', alignItems:'center' }}>{children}</div>;
}

function Chevron() {
  return <span style={{ position:'absolute', right:8, pointerEvents:'none', color:'var(--text-muted)', fontSize:9 }}>▾</span>;
}

function Spinner() {
  return (
    <span style={{
      width:10, height:10, border:'1.5px solid var(--navy)',
      borderTopColor:'transparent', borderRadius:'50%',
      display:'inline-block', animation:'spin 0.6s linear infinite',
    }} />
  );
}

function PlayIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}

function ShareIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}
