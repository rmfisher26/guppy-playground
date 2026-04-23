import React, { useEffect } from 'react';
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

export default function Playground() {
  const { setExamples, setActiveSlot, setSource, setModified } = usePlaygroundStore();

  useEffect(() => {
    setExamples(FALLBACK_EXAMPLES);

    const shared = decodeShareUrl();
    if (shared) {
      // Shared link goes straight into workspace
      setActiveSlot('workspace');
      setSource(shared);
      setModified(false);
    } else {
      // Default: workspace with the starter template
      setActiveSlot('workspace');
      setSource(DEFAULT_SOURCE);
      setModified(false);
    }

    fetchExamples()
      .then(res => setExamples(res.examples))
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header />
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <EditorPane />
        <OutputPane />
      </div>
      <Toast />
    </div>
  );
}
