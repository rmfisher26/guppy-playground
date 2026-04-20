import React, { useEffect } from 'react';
import { usePlaygroundStore } from '../lib/store';
import { fetchExamples, decodeShareUrl } from '../lib/api';
import { FALLBACK_EXAMPLES } from '../lib/examples';
import Header from './ui/Header';
import Toolbar from './ui/Toolbar';
import Toast from './ui/Toast';
import Sidebar from './sidebar/Sidebar';
import EditorPane from './editor/EditorPane';
import OutputPane from './output/OutputPane';

export default function Playground() {
  const { setExamples, setActiveExample, setSource, setModified } = usePlaygroundStore();

  useEffect(() => {
    // Always seed with fallback immediately so UI isn't blank
    setExamples(FALLBACK_EXAMPLES);
    const first = FALLBACK_EXAMPLES[0];
    setActiveExample(first.id);

    // Check for shared code in URL hash
    const shared = decodeShareUrl();
    if (shared) {
      setSource(shared);
      setModified(false);
    } else {
      setSource(first.source);
      setModified(false);
    }

    // Then try to fetch live examples from API
    fetchExamples()
      .then(res => {
        setExamples(res.examples);
      })
      .catch(() => {
        // Silently fall back — already using static examples
      });
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
