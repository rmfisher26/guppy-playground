import React, { useEffect, useRef, useState } from 'react';
import { usePlaygroundStore } from '../lib/store';
import { fetchExamples, decodeShareUrl } from '../lib/api';
import { FALLBACK_EXAMPLES } from '../lib/examples';
import { DEFAULT_SOURCE } from '../lib/defaultSource';
import Header from './ui/Header';
import Toolbar from './ui/Toolbar';
import Toast from './ui/Toast';
import Sidebar from './sidebar/Sidebar';
import EditorPane from './editor/EditorPane';
import OutputPane from './output/OutputPane';

const OUTPUT_MIN = 200;
const OUTPUT_MAX_MARGIN = 200; // editor keeps at least this many px

export default function Playground() {
  const { setExamples, setActiveSlot, setSource, setModified } = usePlaygroundStore();

  const [outputWidth, setOutputWidth] = useState(420);
  const [dividerActive, setDividerActive] = useState(false);
  const [dividerHovered, setDividerHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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

  const dividerHighlighted = dividerActive || dividerHovered;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <Toolbar />
      <div ref={containerRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <EditorPane />

        {/* Drag handle */}
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
