/**
 * PumpX — Browse Markets
 * Fetches all markets from the DB via /api/markets.
 */
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import {
  LuPlus, LuSearch, LuRefreshCw, LuFilter,
  LuTrendingUp, LuCheck, LuClock, LuActivity,
} from 'react-icons/lu';

const FILTERS = [
  { key: 'all', label: 'All Markets' },
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
] as const;
type FilterKey = typeof FILTERS[number]['key'];

interface MarketData {
  id: string;
  contractAddress: string;
  question: string;
  tokenAddress: string;
  threshold: string;
  deadline: string;
  resolved: boolean;
  reached: boolean;
  yesPool: string;
  noPool: string;
  chainId: number;
  stockTicker?: string | null;
  createdAt: string;
  creatorAddress: string;
  _count?: { bets: number };
}

function fmtPool(wei: string) {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '—';
  if (eth < 0.001) return '<0.001 Ξ';
  return `${eth.toFixed(3)} Ξ`;
}

function MarketCard({ m }: { m: MarketData }) {
  const now = Date.now();
  const deadlineTs = new Date(m.deadline).getTime();
  const isActive = !m.resolved && deadlineTs > now;
  const isExpired = !m.resolved && deadlineTs <= now;
  const totalPool = (BigInt(m.yesPool) + BigInt(m.noPool));
  const yesEth = Number(BigInt(m.yesPool)) / 1e18;
  const noEth = Number(BigInt(m.noPool)) / 1e18;
  const totalEth = Number(totalPool) / 1e18;
  const yesPct = totalEth > 0 ? Math.round((yesEth / totalEth) * 100) : 50;

  const timeLeft = () => {
    const diff = deadlineTs - now;
    if (diff <= 0) return 'Ended';
    const d = Math.floor(diff / 86400_000);
    const h = Math.floor((diff % 86400_000) / 3_600_000);
    return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
  };

  return (
    <div className="card p-5 flex flex-col gap-3 hover:border-[var(--accent-primary)]/30 transition-all">
      {/* Status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {m.stockTicker && (
            <span className="text-xs font-mono text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded mb-2 inline-block">
              ${m.stockTicker}
            </span>
          )}
          <p className="font-medium text-[var(--text-primary)] leading-snug line-clamp-2">{m.question}</p>
        </div>
        <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 ${m.resolved
            ? m.reached
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400'
            : isActive
              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'bg-[var(--text-muted)]/10 text-[var(--text-muted)]'
          }`}>
          {m.resolved
            ? m.reached ? <><LuCheck className="w-3 h-3" />YES</> : <><LuCheck className="w-3 h-3" />NO</>
            : isActive
              ? <><LuActivity className="w-3 h-3" />Active</>
              : <><LuClock className="w-3 h-3" />Expired</>
          }
        </span>
      </div>

      {/* Pool bars */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>YES {yesPct}%</span>
          <span>NO {100 - yesPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden flex">
          <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${yesPct}%` }} />
          <div className="bg-red-500 h-full transition-all duration-500 flex-1" />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-green-400">{fmtPool(m.yesPool)}</span>
          <span className="text-[var(--text-muted)]">{m._count?.bets ?? 0} bets</span>
          <span className="text-red-400">{fmtPool(m.noPool)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
          <LuClock className="w-3 h-3" />{isActive ? timeLeft() : new Date(m.deadline).toLocaleDateString()}
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {m.chainId === 8453 ? 'Base' : 'Sepolia'}
        </span>
      </div>
    </div>
  );
}

export default function ViewMarkets() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/markets?limit=100&status=${filter === 'all' ? '' : filter}`)
      .then(r => r.json())
      .then(d => setMarkets(d.markets || []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, [filter, refreshKey]);

  const filtered = useMemo(() => {
    if (!search) return markets;
    const q = search.toLowerCase();
    return markets.filter(m =>
      m.question.toLowerCase().includes(q) ||
      (m.stockTicker?.toLowerCase().includes(q) ?? false) ||
      m.contractAddress.toLowerCase().includes(q)
    );
  }, [markets, search]);

  const active = markets.filter(m => !m.resolved && new Date(m.deadline) > new Date()).length;
  const resolved = markets.filter(m => m.resolved).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Markets</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {active} active · {resolved} resolved · {markets.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="btn-secondary p-2"
            title="Refresh"
          >
            <LuRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/markets">
            <button className="btn-primary flex items-center gap-2">
              <LuPlus className="w-4 h-4" /> Create Market
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search markets, tokens, tickers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${filter === f.key
                  ? 'bg-[var(--accent-primary)] text-white shadow'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card p-5 h-44 animate-pulse bg-[var(--bg-elevated)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center space-y-4">
          <LuTrendingUp className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">No markets yet</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Be the first to create a prediction market on any token.</p>
          </div>
          <Link href="/markets">
            <button className="btn-primary">Create First Market</button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => <MarketCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}
