import React, { useEffect, useState } from 'react';

export default function ActiveBettors() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/stats')
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        const v = d?.totalPredictors ?? d?.totalUsers ?? 0;
        setCount(Number(v));
      })
      .catch(() => { if (mounted) setCount(null); });
    return () => { mounted = false; };
  }, []);

  if (count === null) return (
    <p className="text-sm text-[var(--text-muted)]">Loading…</p>
  );

  if (count === 0) return null;

  return (
    <p className="text-sm text-[var(--text-muted)]">
      <span className="text-[var(--accent-primary)] font-semibold">{count.toLocaleString()}</span> bettors active
    </p>
  );
}
