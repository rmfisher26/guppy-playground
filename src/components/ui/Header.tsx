import React from 'react';

const s: Record<string, React.CSSProperties> = {};

export default function Header() {
  return (
    <header style={{
      height: 'var(--header-h)',
      background: 'var(--navy)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      flexShrink: 0,
      zIndex: 100,
    }}>
      <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0 }}>
        <LogoMark />
        <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>
          guppy<span style={{ color:'var(--teal)' }}>.</span>play
        </span>
      </a>
      <div style={{ width:1, height:20, background:'var(--border-bright)', margin:'0 16px', flexShrink:0 }} />
      <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
        Quantinuum · Selene Emulator
      </span>
      <div style={{ flex:1 }} />
      <nav style={{ display:'flex', alignItems:'center', gap:4 }}>
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

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        height: 28,
        padding: '0 10px',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </a>
  );
}

function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="5" fill="#0a1628"/>
      <path d="M6 14 L14 6 L22 14 L14 22 Z" stroke="#00b4d8" strokeWidth="1.5" fill="none"/>
      <circle cx="14" cy="14" r="3" fill="#00b4d8"/>
      <line x1="14" y1="6" x2="14" y2="22" stroke="#00b4d8" strokeWidth="0.75" opacity="0.4"/>
      <line x1="6"  y1="14" x2="22" y2="14" stroke="#00b4d8" strokeWidth="0.75" opacity="0.4"/>
    </svg>
  );
}

function GithubIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>;
}
function DocsIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
}
