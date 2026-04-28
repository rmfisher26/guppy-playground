import React, { useEffect, useRef, useState } from 'react';
import { usePlaygroundStore } from '../lib/store';
import { fetchExamples, decodeShareUrl } from '../lib/api';
import { FALLBACK_EXAMPLES } from '../lib/examples';
import { DEFAULT_SOURCE } from '../lib/defaultSource';
import { useMobile } from '../lib/useMobile';
import Header from './ui/Header';
import Toolbar from './ui/Toolbar';
import Toast from './ui/Toast';
import Sidebar from './sidebar/Sidebar';
import EditorPane from './editor/EditorPane';
import OutputPane from './output/OutputPane';
import type { RunState } from '../lib/types';

const OUTPUT_MIN = 200;
const OUTPUT_MAX_MARGIN = 200;

type MobilePanel = 'main' | 'examples';

export default function Playground() {
  const { setExamples, setActiveSlot, setSource, setModified, runState } = usePlaygroundStore();
  const isMobile = useMobile();

  // Desktop resize state
  const [outputWidth, setOutputWidth] = useState(420);
  const [dividerActive, setDividerActive] = useState(false);
  const [dividerHovered, setDividerHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Sidebar collapse (desktop)
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Mobile state
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('main');
  const [mobileSplitPct, setMobileSplitPct] = useState(55);
  const [mobileDividerActive, setMobileDividerActive] = useState(false);
  const mobileDragging = useRef(false);
  const mobileMainRef = useRef<HTMLDivElement>(null);

  // Mobile vertical drag
  useEffect(() => {
    const onMove = (clientY: number) => {
      if (!mobileDragging.current || !mobileMainRef.current) return;
      const rect = mobileMainRef.current.getBoundingClientRect();
      const pct = ((clientY - rect.top) / rect.height) * 100;
      setMobileSplitPct(Math.max(20, Math.min(pct, 80)));
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (mobileDragging.current) { e.preventDefault(); onMove(e.touches[0].clientY); }
    };
    const onUp = () => {
      if (!mobileDragging.current) return;
      mobileDragging.current = false;
      setMobileDividerActive(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  function onMobileDividerStart(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    mobileDragging.current = true;
    setMobileDividerActive(true);
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newW = rect.right - e.clientX;
      setOutputWidth(Math.max(OUTPUT_MIN, Math.min(newW, rect.width - OUTPUT_MAX_MARGIN)));
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setDividerActive(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    setExamples(FALLBACK_EXAMPLES);
    const shared = decodeShareUrl();
    if (shared) {
      setActiveSlot('workspace');
      setSource(shared);
      setModified(false);
    } else {
      setActiveSlot('workspace');
      setSource(DEFAULT_SOURCE);
      setModified(false);
    }
    fetchExamples()
      .then(res => setExamples(res.examples))
      .catch(() => {});
  }, []);

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    setDividerActive(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header />
        <Toolbar />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Editor + Output stacked — kept mounted to preserve CodeMirror state */}
          <div
            ref={mobileMainRef}
            style={{ display: mobilePanel === 'main' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ flex: `0 0 ${mobileSplitPct}%`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <EditorPane />
            </div>
            <div
              onMouseDown={onMobileDividerStart}
              onTouchStart={onMobileDividerStart}
              style={{
                height: 5, flexShrink: 0, cursor: 'row-resize', touchAction: 'none',
                background: mobileDividerActive ? 'var(--teal)' : 'var(--border)',
                transition: mobileDividerActive ? 'none' : 'background 0.15s',
              }}
            />
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <OutputPane />
            </div>
          </div>
          <div style={{ display: mobilePanel === 'examples' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <Sidebar />
          </div>
        </div>
        <MobileNav current={mobilePanel} onChange={setMobilePanel} runState={runState} />
        <Toast />
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  const dividerHighlighted = dividerActive || dividerHovered;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <Toolbar />
      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />
        <EditorPane />
        <div
          onMouseDown={onDividerMouseDown}
          onMouseEnter={() => setDividerHovered(true)}
          onMouseLeave={() => setDividerHovered(false)}
          style={{
            width: 5, flexShrink: 0, cursor: 'col-resize', zIndex: 10,
            background: dividerHighlighted ? 'var(--teal)' : 'var(--border)',
            transition: dividerActive ? 'none' : 'background 0.15s',
          }}
        />
        <div style={{ width: outputWidth, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
          <OutputPane />
        </div>
      </div>
      <Toast />
    </div>
  );
}

// ── Mobile bottom nav ──────────────────────────────────────────────────────

function MobileNav({ current, onChange, runState }: {
  current: MobilePanel;
  onChange: (p: MobilePanel) => void;
  runState: RunState;
}) {
  const hasError   = runState.status === 'compile_error';
  const hasSuccess = runState.status === 'success';
  const isRunning  = runState.status === 'compiling' || runState.status === 'simulating';

  const tabs: { id: MobilePanel; label: string; icon: React.ReactNode; dot?: string }[] = [
    { id: 'main',     label: 'Editor',   icon: <CodeIcon />,
      dot: isRunning ? 'var(--teal)' : hasError ? 'var(--red)' : hasSuccess ? 'var(--green)' : undefined },
    { id: 'examples', label: 'Examples', icon: <ExamplesIcon /> },
  ];

  return (
    <nav style={{
      height: 56, flexShrink: 0,
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
    }}>
      {tabs.map(({ id, label, icon, dot }) => {
        const active = current === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              cursor: 'pointer', position: 'relative',
              color: active ? 'var(--teal)' : 'var(--text-muted)',
              borderTop: `2px solid ${active ? 'var(--teal)' : 'transparent'}`,
              transition: 'color 0.15s',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {icon}
            <span style={{ fontSize: 10, fontFamily: 'var(--font-ui)', fontWeight: 500 }}>
              {label}
            </span>
            {dot && (
              <span style={{
                position: 'absolute', top: 6, right: '28%',
                width: 6, height: 6, borderRadius: '50%',
                background: dot,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}

function ExamplesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}
