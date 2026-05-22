import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { leaderboardApi, type LeaderboardEntry } from '../lib/apiClient';

/* ── Rank Badge ──────────────────────────────────── */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xs font-bold">1</span>;
  if (rank === 2) return <span className="w-7 h-7 rounded-full bg-gray-300/20 border border-gray-300/40 flex items-center justify-center text-gray-300 text-xs font-bold">2</span>;
  if (rank === 3) return <span className="w-7 h-7 rounded-full bg-orange-400/20 border border-orange-400/40 flex items-center justify-center text-orange-400 text-xs font-bold">3</span>;
  return <span className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs font-mono">{rank}</span>;
}

/* ── Address display ──────────────────────────────── */
function Addr({ address, isYou }: { address: string; isYou: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/40 to-blue-500/40 shrink-0" />
      <div>
        <span className="font-mono text-xs text-white">{address.slice(0, 6)}…{address.slice(-4)}</span>
        {isYou && <span className="ml-1.5 badge text-[9px] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">You</span>}
      </div>
    </div>
  );
}

/* ── Leaderboard Types ────────────────────────────── */
type TabType = 'volume' | 'winRate' | 'bets' | 'xp';

/* ────────────────────────────────────────────────── */
export default function Leaderboard() {
  const { address: userAddr } = useAccount();
  const [tab, setTab] = useState<TabType>('volume');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    leaderboardApi
      .get(tab, 50)
      .then((res) => {
        setEntries(res.entries);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const topThree = entries.slice(0, 3);
  const formatValue = (entry: LeaderboardEntry) => {
    if (tab === 'volume') return `${(Number(entry.totalVolume || 0) / 1e18).toFixed(4)} ETH`;
    if (tab === 'winRate') return `${((entry.winRate || 0) * 100).toFixed(0)}%`;
    if (tab === 'bets') return `${entry.totalBets || 0} bets`;
    if (tab === 'xp') return `${entry.totalXP || 0} XP`;
    return '';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Top predictors ranked by on-chain activity across all markets
        </p>
      </div>

      {/* Podium — Top 3 */}
      {!loading && topThree.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto">
          {[1, 0, 2].map((idx) => {
            const p = topThree[idx];
            if (!p) return <div key={idx} />;
            const isCenter = idx === 0;
            return (
              <div key={p.address} className={`card text-center ${isCenter ? '!border-amber-400/20 -mt-4' : ''}`}>
                <RankBadge rank={p.rank} />
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/30 to-blue-500/30 mx-auto mt-3 mb-2" />
                <p className="font-mono text-xs text-white">{p.address.slice(0, 6)}…{p.address.slice(-4)}</p>
                {userAddr && p.address.toLowerCase() === userAddr.toLowerCase() && (
                  <span className="badge text-[9px] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 mt-1 inline-block">
                    You
                  </span>
                )}
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-sm font-bold font-mono text-[var(--accent-primary)]">{formatValue(p)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sort Tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">All Predictors</h2>
        <div className="flex bg-[var(--bg-elevated)] rounded-lg p-0.5">
          {[
            { key: 'volume' as const, label: 'Volume' },
            { key: 'winRate' as const, label: 'Win Rate' },
            { key: 'bets' as const, label: 'Bets' },
            { key: 'xp' as const, label: 'XP' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[var(--accent-primary)] text-black'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Predictor</div>
          <div className="col-span-3 text-center">{tab === 'winRate' ? 'Win Rate' : tab === 'bets' ? 'Total Bets' : tab === 'xp' ? 'XP' : 'Volume'}</div>
          <div className="col-span-3 text-right">{tab === 'volume' ? 'Total Bets' : 'Rank'}</div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">Loading leaderboard data…</div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
            No leaderboard data yet. Place bets to appear here!
          </div>
        ) : (
          entries.map((p, i) => (
            <div
              key={p.address}
              className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors ${
                userAddr && p.address.toLowerCase() === userAddr.toLowerCase() ? 'bg-[var(--accent-primary)]/5' : ''
              }`}
            >
              <div className="col-span-1">
                <RankBadge rank={p.rank} />
              </div>
              <div className="col-span-5">
                <Addr
                  address={p.address}
                  isYou={!!userAddr && p.address.toLowerCase() === userAddr.toLowerCase()}
                />
              </div>
              <div className="col-span-3 text-center">
                <span className="text-xs font-mono text-white">{formatValue(p)}</span>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  {tab === 'volume' ? `${p.totalBets || 0} bets` : `#${p.rank}`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Note */}
      <p className="text-[10px] text-[var(--text-muted)] text-center mt-6">
        Rankings computed from on-chain indexed events via the PumpX event indexer.
      </p>
    </div>
  );
}
