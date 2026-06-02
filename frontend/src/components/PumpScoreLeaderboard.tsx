import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type Row = {
  tokenAddress: string;
  symbol: string | null;
  pumpScore: number;
  change24: number | null;
  marketCount: number;
}

function truncate(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export default function PumpScoreLeaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/intelligence/top-tokens')
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        if (d?.data) setRows(d.data);
        else setRows([]);
      })
      .catch(() => { if (mounted) setRows([]); });
    return () => { mounted = false; };
  }, []);

  if (rows === null) {
    return (
      <div className="py-8 text-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--accent-primary)] rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--text-muted)]">Scores updating…</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] text-[var(--text-muted)] uppercase">
            <th className="p-2">Token</th>
            <th className="p-2">Contract</th>
            <th className="p-2">PumpScore</th>
            <th className="p-2">24h</th>
            <th className="p-2">Markets</th>
            <th className="p-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.tokenAddress} className="border-t border-white/5">
              <td className="p-2 align-top">
                <div className="text-sm font-medium">{r.symbol ?? 'Unknown'}</div>
              </td>
              <td className="p-2 align-top font-mono text-[var(--text-muted)]">{truncate(r.tokenAddress)}</td>
              <td className="p-2 align-top font-mono text-white">{r.pumpScore.toFixed(2)}</td>
              <td className={`p-2 align-top font-mono ${r.change24 === null ? 'text-[var(--text-muted)]' : r.change24 >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {r.change24 === null ? '—' : (r.change24 >= 0 ? '+' : '') + r.change24.toFixed(2) + '%'}
              </td>
              <td className="p-2 align-top font-mono text-[var(--text-muted)]">{r.marketCount}</td>
              <td className="p-2 text-right">
                <Link href={`/markets?tokenAddress=${encodeURIComponent(r.tokenAddress)}`} className="btn-primary text-xs px-3 py-1">
                  Create Market
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
