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
const OUTPUT_MIN = 200;
const EDITOR_MIN = 200;
const SIDEBAR_W_OPEN = 220;
const SIDEBAR_W_CLOSED = 32;
const DIVIDER_W = 5;

export default function Playground() {
  const { setExamples, setActiveSlot, setSource, setModified } = usePlaygroundStore();
  const isMobile = useMobile();

  // Desktop resize state
  const [outputWidth, setOutputWidth] = useState(420);
  const [dividerActive, setDividerActive] = useState(false);
  const [dividerHovered, setDividerHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // Sidebar collapse (desktop)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarOpenRef = useRef(true);
  useEffect(() => { sidebarOpenRef.current = sidebarOpen; }, [sidebarOpen]);

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
      const sidebarW = sidebarOpenRef.current ? SIDEBAR_W_OPEN : SIDEBAR_W_CLOSED;
      const maxW = rect.width - sidebarW - DIVIDER_W - EDITOR_MIN;
      setOutputWidth(Math.max(OUTPUT_MIN, Math.min(newW, maxW)));
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Header />
        <Toolbar />
        <div ref={mobileMainRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: `0 0 ${mobileSplitPct}%`, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <EditorPane />
          </div>
          <div
            onMouseDown={onMobileDividerStart}
            onTouchStart={onMobileDividerStart}
            style={{
              height: 24, flexShrink: 0, cursor: 'row-resize', touchAction: 'none',
              background: mobileDividerActive ? 'var(--teal-subtle)' : 'var(--bg-surface)',
              borderTop: `1px solid ${mobileDividerActive ? 'var(--teal)' : 'var(--border)'}`,
              borderBottom: `1px solid ${mobileDividerActive ? 'var(--teal)' : 'var(--border)'}`,
              transition: mobileDividerActive ? 'none' : 'background 0.15s, border-color 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{
              width: 32, height: 4, borderRadius: 2,
              background: mobileDividerActive ? 'var(--teal)' : 'var(--border-bright)',
              transition: mobileDividerActive ? 'none' : 'background 0.15s',
            }} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <OutputPane isMobile />
          </div>
        </div>
        <Toast />
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  const dividerHighlighted = dividerActive || dividerHovered;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
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

