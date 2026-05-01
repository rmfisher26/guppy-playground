import { useState, useEffect } from 'react';

export function useMobile(bp = 768): boolean {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const handle = () => setMobile(window.innerWidth < bp);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [bp]);
  return mobile;
}
