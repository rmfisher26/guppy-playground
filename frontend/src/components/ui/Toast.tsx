import React, { useEffect, useState } from 'react';
import { usePlaygroundStore } from '../../lib/store';

export default function Toast() {
  const { toastMessage } = usePlaygroundStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toastMessage) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [toastMessage]);

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '16px'})`,
      background: 'var(--bg-raised)', border: '1px solid var(--border-bright)',
      borderRadius: 'var(--radius)', padding: '10px 16px',
      fontSize: 12, color: 'var(--text-primary)',
      display: 'flex', alignItems: 'center', gap: 8,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.2s, transform 0.2s',
      pointerEvents: 'none', zIndex: 999,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <span style={{ color: 'var(--green)' }}>✓</span>
      {toastMessage}
    </div>
  );
}
