import React, { useRef, useState, useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { useRun } from '../hooks/useRun';
import { encodeShareUrl } from '../../lib/api';
import { useMobile } from '../../lib/useMobile';
import type { SimulatorBackend, NoiseModelKind } from '../../lib/types';

type ActionKey = 'run' | 'check' | 'compile';

export default function Toolbar() {
  const { shots, setShots, simulator, setSimulator, noiseModel, setNoiseModel, errorRate, setErrorRate, guppyVersion, setGuppyVersion, availableVersions, runState, showToast, source } = usePlaygroundStore();
  const isMobile = useMobile();
  const { run, compile, check } = useRun();
  const isRunning = runState.status === 'compiling' || runState.status === 'simulating';
  const canRun = !/\.compile(?:_function)?\s*\(/.test(source);

  const [activeAction, setActiveAction] = useState<ActionKey>('run');
  const ACTIONS: Record<ActionKey, { label: string; icon: React.ReactNode; fn: () => void; needsCanRun: boolean }> = {
    run:     { label: 'Run',             icon: <PlayIcon />,    fn: run,     needsCanRun: true  },
    check:   { label: 'Linearity Check', icon: <CheckIcon />,   fn: check,   needsCanRun: false },
    compile: { label: 'Compile',         icon: <CompileIcon />, fn: compile, needsCanRun: false },
  };
  const action = ACTIONS[activeAction];
  const isDisabled = isRunning || (action.needsCanRun && !canRun);

  function handleShare() {
    const { source, shots, simulator, noiseModel, errorRate, guppyVersion } = usePlaygroundStore.getState();
    const url = encodeShareUrl({ source, shots, simulator, noiseModel, errorRate, guppyVersion });
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
    { value: 'stabilizer',  label: 'Stabilizer',  tag: 'Stim',  description: 'Clifford circuits only — fast, supports up to 50 qubits.' },
    { value: 'statevector', label: 'Statevector',  tag: 'QuEST', description: 'Exact amplitudes, arbitrary gates — limited to 20 qubits.' },
  ];

  const versionOptions: SelectOption<string>[] = availableVersions.map(v => ({ value: v, label: v }));

  const shotOptions: SelectOption<number>[] = [
    { value: 256,  label: '256'  },
    { value: 1024, label: '1024' },
    { value: 4096, label: '4096' },
    { value: 8192, label: '8192' },
  ];

  type NoiseOption = { value: NoiseModelKind | null; label: string; description?: string; code?: string };
  const noiseOptions: NoiseOption[] = [
    { value: null,           label: 'Ideal',
      description: 'Perfect gate fidelity — no noise applied.' },
    { value: 'depolarizing', label: 'Depolarizing',
      description: 'Uniform depolarizing channel on all gates and measurements.',
      code: 'DepolarizingErrorModel(p_1q=p, p_2q=p, p_meas=p, p_init=p)' },
    { value: 'leakage',      label: 'Leakage',
      description: 'Qubits may leak to an auxiliary state on single- and two-qubit gates.',
      code: 'SimpleLeakageErrorModel(p_leak=p)' },
  ];

  // Log-scale slider: range 0–100 maps to p in [1e-4, 0.1]
  const sliderToRate = (t: number) => Math.pow(10, -4 + t * 3 / 100);
  const rateToSlider = (p: number) => Math.round(((Math.log10(p) + 4) / 3) * 100);
  const fmtRate = (p: number) => p < 0.001
    ? `${(p * 10000).toFixed(1)}×10⁻⁴`
    : `${(p * 100).toFixed(p < 0.01 ? 2 : 1)}%`;

  const noiseRow = (
    <div style={{
      height: 36, display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 8,
      borderTop: '1px solid var(--border)',
    }}>
      <NoiseSelect
        value={noiseModel}
        onChange={v => setNoiseModel(v)}
        options={noiseOptions}
      />
      {noiseModel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={rateToSlider(errorRate)}
            onChange={e => setErrorRate(sliderToRate(Number(e.target.value)))}
            style={{ flex: 1, minWidth: 0, accentColor: 'var(--amber, #f59e0b)', cursor: 'pointer' }}
            title={`Error rate p = ${fmtRate(errorRate)}`}
          />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--amber, #f59e0b)', minWidth: 40, textAlign: 'right',
          }}>
            {fmtRate(errorRate)}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Primary row */}
      <div style={{
        height: 'var(--toolbar-h)', display: 'flex',
        alignItems: 'center', padding: '0 12px', gap: 8,
      }}>
        {/* Run split-button */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <button
            style={{
              ...btnBase,
              borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
              background: isDisabled ? 'var(--teal-dim)' : 'var(--teal)',
              color: isDisabled ? 'var(--text-muted)' : 'var(--navy)', fontWeight: 600, padding: '0 14px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
            }}
            onClick={() => !isDisabled && action.fn()}
            title={action.needsCanRun && !canRun ? 'This program compiles to HUGR only — use Compile' : undefined}
          >
            {isRunning
              ? <><Spinner /> {{ run: 'Running…', check: 'Checking…', compile: 'Compiling…' }[activeAction as ActionKey]}</>
              : <>{action.icon} {action.label}</>
            }
          </button>
          <RunActionMenu
            isRunning={isRunning} canRun={canRun}
            activeAction={activeAction} onActionSelect={setActiveAction}
          />
        </div>

        <div style={{ width: 1, height: 16, background: 'var(--border-bright)', flexShrink: 0 }} />

        {/* Version picker — only shown when multiple versions are available */}
        {versionOptions.length > 1 && (
          <CustomSelect
            value={guppyVersion}
            onChange={v => setGuppyVersion(v)}
            options={versionOptions}
          />
        )}

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

        {/* Desktop-only: divider + noise controls inline */}
        {!isMobile && (
          <>
            <div style={{ width: 1, height: 16, background: 'var(--border-bright)', flexShrink: 0 }} />

            <NoiseSelect
              value={noiseModel}
              onChange={v => setNoiseModel(v)}
              options={noiseOptions}
            />

            {noiseModel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rateToSlider(errorRate)}
                  onChange={e => setErrorRate(sliderToRate(Number(e.target.value)))}
                  style={{ width: 88, accentColor: 'var(--amber, #f59e0b)', cursor: 'pointer' }}
                  title={`Error rate p = ${fmtRate(errorRate)}`}
                />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--amber, #f59e0b)', minWidth: 36,
                }}>
                  {fmtRate(errorRate)}
                </span>
              </div>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        <button
          style={{ ...btnBase, background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent' }}
          onClick={handleShare}
          title="Copy share link"
          onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border)'; el.style.background = 'var(--bg-raised)'; }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-muted)'; el.style.borderColor = 'transparent'; el.style.background = 'transparent'; }}
        >
          <ShareIcon />{!isMobile && ' Share'}
        </button>
      </div>

      {/* Mobile-only second row: noise model + slider */}
      {isMobile && noiseRow}
    </div>
  );
}

// ── Noise model select ────────────────────────────────────────────────────────

function NoiseSelect<T extends string | null>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string; code?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isNoisy = value !== null;

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
      <button
        onClick={() => setOpen(o => !o)}
        title="Noise model"
        style={{
          height: 28, padding: '0 8px 0 10px',
          background: isNoisy ? 'color-mix(in srgb, #f59e0b 12%, var(--bg-raised))' : open ? 'var(--bg-hover)' : 'var(--bg-raised)',
          border: `1px solid ${isNoisy ? '#f59e0b' : open ? 'var(--teal)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'border-color 0.15s, background 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!open && !isNoisy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-bright)'; }}
        onMouseLeave={e => { if (!open && !isNoisy) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
      >
        <NoiseIcon active={isNoisy} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 500, color: isNoisy ? '#f59e0b' : 'var(--text-primary)' }}>
          {current?.label ?? 'Ideal'}
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 200, overflow: 'hidden', minWidth: 320,
          animation: 'fadeSlideIn 0.1s ease',
        }}>
          {options.map(opt => (
            <DropdownOption
              key={String(opt.value)}
              label={opt.label}
              description={opt.description}
              code={opt.code}
              active={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom select ─────────────────────────────────────────────────────────────

type SelectOption<T> = { value: T; label: string; tag?: string; description?: string };

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
          minWidth: options.some(o => o.description) ? 220 : '100%',
          animation: 'fadeSlideIn 0.1s ease',
        }}>
          {options.map(opt => (
            <DropdownOption
              key={String(opt.value)}
              label={opt.label}
              tag={opt.tag}
              suffix={!opt.tag ? suffix : undefined}
              description={opt.description}
              active={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({ label, tag, suffix, description, code, active, onClick }: {
  label: string; tag?: string; suffix?: string; description?: string; code?: string; active: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: description ? '7px 12px 7px 10px' : '6px 12px 6px 10px',
        background: active ? 'var(--teal-subtle)' : hovered ? 'var(--bg-hover)' : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        textAlign: 'left',
        borderLeft: `2px solid ${active ? 'var(--teal)' : 'transparent'}`,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%' }}>
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
      </div>
      {description && (
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 10,
          color: 'var(--text-muted)', lineHeight: 1.4,
        }}>
          {description}
        </span>
      )}
      {code && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--teal)', lineHeight: 1.4,
        }}>
          {code}
        </span>
      )}
    </button>
  );
}

// ── Run action menu ───────────────────────────────────────────────────────────

function RunActionMenu({ isRunning, canRun, activeAction, onActionSelect }: {
  isRunning: boolean;
  canRun: boolean;
  activeAction: ActionKey;
  onActionSelect: (k: ActionKey) => void;
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

  const actions: { icon: React.ReactNode; title: string; description: string; code?: string; onClick: () => void; disabled: boolean }[] = [
    {
      icon: <PlayIcon />,
      title: 'Run',
      description: 'Compile and simulate on the quantum emulator using the shots and simulator settings. View measurement counts in the Results tab.',
      code: 'main.emulator(n_shots).run()',
      onClick: () => { onActionSelect('run'); setOpen(false); },
      disabled: !canRun || isRunning,
    },
    {
      icon: <CompileIcon />,
      title: 'Compile to HUGR',
      description: 'Compile to the HUGR quantum intermediate representation and inspect in the HUGR tab.',
      code: 'main.compile()  /  fn.compile_function()',
      onClick: () => { onActionSelect('compile'); setOpen(false); },
      disabled: isRunning,
    },
    {
      icon: <CheckIcon />,
      title: 'Linearity Check',
      description: 'Type-check the program for qubit linearity violations — each qubit must be used exactly once with no leaks or double-use. No simulation runs.',
      code: 'main.check()',
      onClick: () => { onActionSelect('check'); setOpen(false); },
      disabled: isRunning,
    },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 28, width: 22, padding: 0,
          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          background: open ? 'color-mix(in srgb, var(--teal) 80%, #000)' : 'var(--teal)',
          borderLeft: '1px solid rgba(0,0,0,0.2)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Show run options"
      >
        <ChevronIcon open={open} color="#fff" />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          background: 'var(--bg-raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 300, width: 300,
          animation: 'fadeSlideIn 0.1s ease',
        }}>
          {actions.map((action, i) => (
            <ActionRow
              key={action.title}
              icon={action.icon}
              title={action.title}
              description={action.description}
              code={action.code}
              disabled={action.disabled}
              onClick={action.onClick}
              isLast={i === actions.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ icon, title, description, code, disabled, onClick, isLast }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  code?: string;
  disabled: boolean;
  onClick: () => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', padding: '10px 14px',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        border: 'none',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.38 : 1,
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ color: 'var(--teal)', flexShrink: 0, display: 'flex' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </span>
      </div>
      <p style={{ margin: 0, paddingLeft: 18, fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        {description}
      </p>
      {code && (
        <p style={{ margin: '5px 0 0', paddingLeft: 18, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)', lineHeight: 1.4 }}>
          {code}
        </p>
      )}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronIcon({ open, color = 'var(--text-muted)' }: { open: boolean; color?: string }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ color, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
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

function CompileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ShareIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>;
}

function NoiseIcon({ active }: { active: boolean }) {
  const color = active ? '#f59e0b' : 'var(--text-muted)';
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M2 12 Q5 6 8 12 Q11 18 14 12 Q17 6 20 12 Q21.5 15 22 12" />
    </svg>
  );
}
