import React, { useEffect } from 'react';
import { usePlaygroundStore } from '../../lib/store';
import { applyTheme } from '../../lib/store';
import type { Theme } from '../../lib/store';
import { useMobile } from '../../lib/useMobile';

export default function Header() {
  const { theme, setTheme } = usePlaygroundStore();
  const isMobile = useMobile();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <header style={{
      height: 'var(--header-h)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', flexShrink: 0, zIndex: 100,
    }}>
      <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
        <span style={{ fontFamily:"'Figtree', sans-serif", fontWeight:600, fontSize:15, letterSpacing:'-0.03em', display:'flex', gap:1 }}>
          <span style={{ color:'#30a08e' }}>GUPPY</span><span style={{ color:'var(--logo-fisher)' }}>FISHER</span><span style={{ color:'var(--text-primary)' }}>&nbsp;POND</span>
        </span>
      </a>

      {!isMobile && (
        <>
          <div style={{ width:1, height:20, background:'var(--border-bright)', margin:'0 16px', flexShrink:0 }} />
          <span style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:'var(--font-ui)' }}>
            Write and simulate quantum programs with Guppy
          </span>
        </>
      )}

      <div style={{ flex:1 }} />

      <nav style={{ display:'flex', alignItems:'center', gap: isMobile ? 4 : 8 }}>
        <ThemeToggle current={theme} onChange={setTheme} />
        <div style={{ width:1, height:16, background:'var(--border-bright)', flexShrink:0 }} />
        <HeaderLink href="https://github.com/Quantinuum/guppylang">
          <GithubIcon /> GitHub
        </HeaderLink>
        <HeaderLink href="https://docs.quantinuum.com/guppy/">
          <DocsIcon /> Docs
        </HeaderLink>
      </nav>
    </header>
  );
}

function ThemeToggle({ current, onChange }: { current: Theme; onChange: (t: Theme) => void }) {
  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'dark',   icon: <MoonIcon />,    label: 'Dark'   },
    { value: 'light',  icon: <SunIcon />,     label: 'Light'  },
    { value: 'system', icon: <MonitorIcon />, label: 'System' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--border-bright)',
      borderRadius: 'var(--radius)',
      padding: 2, gap: 1,
    }}>
      {options.map(({ value, icon, label }) => {
        const active = current === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            title={label}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 26, height: 22, border: 'none', borderRadius: 4,
              cursor: 'pointer',
              background: active ? 'var(--teal)' : 'transparent',
              color: active ? '#fff' : 'var(--text-muted)',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        height: 28, padding: '0 10px', borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 5,
        textDecoration: 'none', transition: 'color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </a>
  );
}


function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

function GithubIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
}
function DocsIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
