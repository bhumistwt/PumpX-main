import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, useEnsName } from 'wagmi';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { truncateAddress } from '../lib/addresses';

interface PumpScoreEntry {
  rank: number;
  address: string;
  winRate: number;
  roiPercent: number;
  totalMarkets: number;
  totalBets: number;
  pumpScore: number;
  displayRank?: number;
}

type SortKey = 'rank' | 'winRate' | 'roiPercent' | 'totalMarkets' | 'pumpScore';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 text-xs font-bold">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="w-7 h-7 rounded-full bg-gray-300/20 border border-gray-300/40 flex items-center justify-center text-gray-300 text-xs font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="w-7 h-7 rounded-full bg-orange-400/20 border border-orange-400/40 flex items-center justify-center text-orange-400 text-xs font-bold">
        3
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] text-xs font-mono">
      {rank}
    </span>
  );
}

function WalletCell({ address, isYou }: { address: string; isYou: boolean }) {
  const { data: ensName } = useEnsName({ address: address as `0x${string}` });

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-primary)]/40 to-blue-500/40 shrink-0" />
      <div className="min-w-0">
        <Link
          href={`/wallet/${address}`}
          className="font-mono text-xs text-white hover:text-[var(--accent-primary)] truncate block"
        >
          {ensName || truncateAddress(address)}
        </Link>
        {ensName && (
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{truncateAddress(address)}</span>
        )}
        {isYou && (
          <span className="ml-1 badge text-[9px] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
            You
          </span>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex items-center justify-center gap-1 w-full text-[10px] uppercase tracking-wider font-medium hover:text-white transition-colors ${className} ${
        active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
      }`}
    >
      {label}
      {active ? (
        direction === 'asc' ? <LuChevronUp className="w-3 h-3" /> : <LuChevronDown className="w-3 h-3" />
      ) : null}
    </button>
  );
}

export default function Leaderboard() {
  const { address: userAddr } = useAccount();
  const [entries, setEntries] = useState<PumpScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('pumpScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    fetch('/api/leaderboard?type=pumpScore&limit=50')
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        setCalculatedAt(data.calculatedAt ?? null);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...entries];
    const mul = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const av = sortKey === 'rank' ? a.rank : a[sortKey];
      const bv = sortKey === 'rank' ? b.rank : b[sortKey];
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return 0;
    });
    return list.map((e, i) => ({ ...e, displayRank: sortKey === 'rank' && sortDir === 'asc' ? entries.length - i : i + 1 }));
  }, [entries, sortKey, sortDir]);

  const topThree = [...entries].sort((a, b) => b.pumpScore - a.pumpScore).slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-2xl font-bold text-white mb-2">PumpScore Leaderboard</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Top predictors ranked by composite PumpScore (Accuracy 40% · ROI 30% · Participation 20% · Consistency 10%)
        </p>
        {calculatedAt && (
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            Scores recalculated hourly · Last update {new Date(calculatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {!loading && topThree.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto">
          {[1, 0, 2].map((idx) => {
            const p = topThree[idx];
            if (!p) return <div key={idx} />;
            const isCenter = idx === 0;
            return (
              <div key={p.address} className={`card text-center ${isCenter ? '!border-amber-400/20 -mt-4' : ''}`}>
                <RankBadge rank={p.rank} />
                <p className="font-mono text-xs text-white mt-3">{truncateAddress(p.address)}</p>
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-lg font-bold font-mono text-[var(--accent-primary)]">{p.pumpScore.toFixed(1)}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">PumpScore</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card !p-0 overflow-hidden overflow-x-auto">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[var(--bg-elevated)] min-w-[640px]">
          <div className="col-span-1">
            <SortHeader label="#" sortKey="rank" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
          </div>
          <div className="col-span-4 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium text-left">
            Wallet
          </div>
          <div className="col-span-2">
            <SortHeader label="Win rate" sortKey="winRate" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
          </div>
          <div className="col-span-2">
            <SortHeader label="ROI" sortKey="roiPercent" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
          </div>
          <div className="col-span-1">
            <SortHeader label="Mkts" sortKey="totalMarkets" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
          </div>
          <div className="col-span-2">
            <SortHeader label="PumpScore" sortKey="pumpScore" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
            No leaderboard data yet. Place bets to appear here!
          </div>
        ) : (
          sorted.map((p) => (
            <div
              key={p.address}
              className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-white/5 last:border-0 hover:bg-white/[0.02] min-w-[640px] ${
                userAddr && p.address === userAddr.toLowerCase() ? 'bg-[var(--accent-primary)]/5' : ''
              }`}
            >
              <div className="col-span-1">
                <RankBadge rank={p.displayRank ?? p.rank} />
              </div>
              <div className="col-span-4">
                <WalletCell
                  address={p.address}
                  isYou={!!userAddr && p.address === userAddr.toLowerCase()}
                />
              </div>
              <div className="col-span-2 text-center text-xs font-mono text-white">{p.winRate.toFixed(1)}%</div>
              <div
                className={`col-span-2 text-center text-xs font-mono ${
                  p.roiPercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {p.roiPercent >= 0 ? '+' : ''}
                {p.roiPercent.toFixed(1)}%
              </div>
              <div className="col-span-1 text-center text-xs font-mono text-[var(--text-secondary)]">
                {p.totalMarkets}
              </div>
              <div className="col-span-2 text-center text-xs font-mono font-bold text-[var(--accent-primary)]">
                {p.pumpScore.toFixed(1)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
