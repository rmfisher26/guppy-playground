import React, { useRef, useState, useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { useRun } from '../hooks/useRun';
import { encodeShareUrl } from '../../lib/api';
import type { SimulatorBackend } from '../../lib/types';

export default function Toolbar() {
  const { shots, setShots, simulator, setSimulator, runState, showToast } = usePlaygroundStore();
  const { run } = useRun();
  const isRunning = runState.status === 'compiling' || runState.status === 'simulating';

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

  const simulatorOptions: SelectOption<SimulatorBackend>[] = [
    { value: 'stabilizer',  label: 'Stabilizer',  tag: 'Stim'  },
    { value: 'statevector', label: 'Statevector',  tag: 'QuEST' },
  ];

  const shotOptions: SelectOption<number>[] = [
    { value: 256,  label: '256'  },
    { value: 1024, label: '1024' },
    { value: 4096, label: '4096' },
    { value: 8192, label: '8192' },
  ];

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

      <div style={{ width: 1, height: 16, background: 'var(--border-bright)', flexShrink: 0 }} />

      {/* Simulator */}
      <CustomSelect
        value={simulator}
        onChange={v => setSimulator(v)}
        options={simulatorOptions}
        suffix="shots"
      />

      {/* Shots */}
      <CustomSelect
        value={shots}
        onChange={v => setShots(v)}
        options={shotOptions}
        suffix="shots"
      />

      <div style={{ flex: 1 }} />

      <button
        style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }}
        onClick={handleShare}
        title="Copy share link"
        onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-raised)'; }}
        onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'transparent'; el.style.background = 'transparent'; }}
      >
        <ShareIcon /> Share
      </button>

    </div>
  );
}

// ── Custom select ─────────────────────────────────────────────────────────────

type SelectOption<T> = { value: T; label: string; tag?: string };

function CustomSelect<T extends string | number>({
  value, onChange, options, suffix,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  suffix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 28, padding: '0 8px 0 10px',
          background: open ? 'var(--bg-hover)' : 'var(--bg-raised)',
          border: `1px solid ${open ? 'var(--teal)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'border-color 0.15s, background 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
      >
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
          {current?.label}
        </span>
        {current?.tag && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
            background: 'var(--bg-base)', border: '1px solid var(--border)',
            borderRadius: 3, padding: '1px 4px', lineHeight: 1.4,
          }}>
            {current.tag}
          </span>
        )}
        {!current?.tag && suffix && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 200,
          overflow: 'hidden',
          minWidth: '100%',
          animation: 'fadeSlideIn 0.1s ease',
        }}>
          {options.map(opt => (
            <DropdownOption
              key={String(opt.value)}
              label={opt.label}
              tag={opt.tag}
              suffix={!opt.tag ? suffix : undefined}
              active={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({ label, tag, suffix, active, onClick }: {
  label: string; tag?: string; suffix?: string; active: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '6px 12px 6px 10px',
        background: active ? 'var(--teal-subtle)' : hovered ? 'var(--bg-hover)' : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 7,
        textAlign: 'left',
        borderLeft: `2px solid ${active ? 'var(--teal)' : 'transparent'}`,
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: 12,
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        flex: 1,
      }}>
        {label}
      </span>
      {tag && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: active ? 'var(--text-teal)' : 'var(--text-muted)',
          background: active ? 'var(--teal-subtle)' : 'var(--bg-base)',
          border: `1px solid ${active ? 'var(--teal-dim)' : 'var(--border)'}`,
          borderRadius: 3, padding: '1px 4px', lineHeight: 1.4,
        }}>
          {tag}
        </span>
      )}
      {!tag && suffix && (
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)' }}>
          {suffix}
        </span>
      )}
    </button>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: 'var(--text-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 10, height: 10, border: '1.5px solid var(--navy)',
      borderTopColor: 'transparent', borderRadius: '50%',
      display: 'inline-block', animation: 'spin 0.6s linear infinite',
    }} />
  );
}

function PlayIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>;
}

function ShareIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>;
}
