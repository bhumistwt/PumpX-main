/**
 * PumpX — Live Worldwide Markets Dashboard
 *
 * Real-time data from global markets:
 *   • Top 50 Cryptocurrencies (CoinGecko)
 *   • Forex Pairs (ECB / Frankfurter)
 *   • Global Crypto Stats
 *   • Trending Coins
 *   • World Indices & Commodities
 */

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  LuGlobe2,
  LuTrendingUp,
  LuTrendingDown,
  LuRefreshCw,
  LuSearch,
  LuChevronDown,
  LuChevronUp,
  LuDollarSign,
  LuBarChart3,
  LuActivity,
  LuFlame,
  LuArrowUpRight,
  LuArrowDownRight,
  LuClock,
  LuStar,
  LuCoins,
  LuBitcoin,
  LuLineChart,
} from 'react-icons/lu';
import { useLiveMarkets } from '../hooks/useLiveMarkets';
import type { CryptoAsset, ForexRate, IndexData, CommodityData, TrendingCoin } from '../lib/liveMarkets';

// ── Helpers ──────────────────────────────────────────────

function fmt(n: number, dec = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(dec)}`;
}

function fmtNum(n: number, dec = 2): string {
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(dec);
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ── Mini Sparkline ──────────────────────────────────────

function MiniSparkline({ data, width = 100, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const trend = data[data.length - 1] >= data[0];
  const color = trend ? '#10b981' : '#ef4444';

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' L');

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={`sp-${color}-${width}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`M${points} L${width},${height} L0,${height} Z`} fill={`url(#sp-${color}-${width})`} />
      <path d={`M${points}`} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

// ── Change Badge ────────────────────────────────────────

function ChangeBadge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const isPositive = value >= 0;
  const sizeClass = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }[size];

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md font-mono font-medium ${sizeClass} ${
      isPositive
        ? 'text-emerald-400 bg-emerald-400/10'
        : 'text-red-400 bg-red-400/10'
    }`}>
      {isPositive ? <LuArrowUpRight className="w-3 h-3" /> : <LuArrowDownRight className="w-3 h-3" />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// ── Tab Button ──────────────────────────────────────────

type Tab = 'crypto' | 'forex' | 'indices' | 'commodities' | 'trending';

function TabBtn({ active, label, icon: Icon, count, onClick }: {
  active: boolean;
  label: string;
  icon: React.ElementType;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
        active
          ? 'bg-[var(--accent-primary)] text-[#0a0e17] shadow-lg shadow-[var(--accent-primary)]/20'
          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white hover:bg-white/10 border border-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-black/20' : 'bg-white/5'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Crypto Row ──────────────────────────────────────────

function CryptoRow({ coin, rank }: { coin: CryptoAsset; rank: number }) {
  const is7dPositive = (coin.price_change_percentage_7d_in_currency ?? 0) >= 0;
  const sparkData = coin.sparkline_in_7d?.price;
  // Downsample sparkline for performance
  const downsampled = useMemo(() => {
    if (!sparkData || sparkData.length === 0) return [];
    const step = Math.max(1, Math.floor(sparkData.length / 50));
    return sparkData.filter((_, i) => i % step === 0);
  }, [sparkData]);

  return (
    <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_100px] gap-3 items-center py-3 px-4 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
      <span className="text-xs text-[var(--text-muted)] font-mono text-center">{rank}</span>
      <div className="flex items-center gap-3 min-w-0">
        <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full shrink-0" loading="lazy" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{coin.name}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase">{coin.symbol}</p>
        </div>
      </div>
      <p className="text-sm font-mono font-semibold text-white text-right">{fmtPrice(coin.current_price)}</p>
      <div className="text-right">
        <ChangeBadge value={coin.price_change_percentage_24h} size="sm" />
      </div>
      <div className="text-right">
        <span className={`text-xs font-mono ${is7dPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {(coin.price_change_percentage_7d_in_currency ?? 0) >= 0 ? '+' : ''}
          {(coin.price_change_percentage_7d_in_currency ?? 0).toFixed(2)}%
        </span>
      </div>
      <p className="text-xs font-mono text-[var(--text-secondary)] text-right">{fmt(coin.market_cap)}</p>
      <div className="flex justify-end">
        <MiniSparkline data={downsampled} width={80} height={28} />
      </div>
    </div>
  );
}

// ── Crypto Card (mobile) ────────────────────────────────

function CryptoCard({ coin }: { coin: CryptoAsset }) {
  const sparkData = coin.sparkline_in_7d?.price;
  const downsampled = useMemo(() => {
    if (!sparkData || sparkData.length === 0) return [];
    const step = Math.max(1, Math.floor(sparkData.length / 40));
    return sparkData.filter((_, i) => i % step === 0);
  }, [sparkData]);

  return (
    <div className="card !p-4 hover:border-[var(--border-accent)] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" loading="lazy" />
          <div>
            <p className="text-sm font-bold text-white">{coin.name}</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase">#{coin.market_cap_rank} • {coin.symbol}</p>
          </div>
        </div>
        <ChangeBadge value={coin.price_change_percentage_24h} />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-bold font-mono text-white">{fmtPrice(coin.current_price)}</p>
          <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
            MCap: {fmt(coin.market_cap)} · Vol: {fmt(coin.total_volume)}
          </p>
        </div>
        <MiniSparkline data={downsampled} width={70} height={28} />
      </div>
    </div>
  );
}

// ── Forex Table ─────────────────────────────────────────

function ForexTable({ rates }: { rates: ForexRate[] }) {
  if (rates.length === 0) {
    return <EmptyBlock label="Forex data loading..." />;
  }
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-white/[0.02] text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium border-b border-white/5">
        <span>Pair</span>
        <span className="text-right">Rate</span>
        <span className="text-right">Change</span>
      </div>
      {rates.map((r) => (
        <div key={r.pair} className="grid grid-cols-[1fr_1fr_1fr] gap-3 items-center px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/5 last:border-0">
          <div className="flex items-center gap-2">
            <LuDollarSign className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-sm font-semibold text-white">{r.pair}</span>
          </div>
          <p className="text-sm font-mono text-white text-right">{r.rate.toFixed(4)}</p>
          <div className="text-right">
            <ChangeBadge value={r.changePercent} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Indices Table ───────────────────────────────────────

function IndicesTable({ indices }: { indices: IndexData[] }) {
  const hasData = indices.some(i => i.price > 0);
  return (
    <div className="space-y-3">
      {!hasData && (
        <div className="card !p-4 border-yellow-500/20">
          <p className="text-xs text-yellow-400">
            💡 Add <code className="bg-white/5 px-1 rounded">ALPHA_VANTAGE_API_KEY</code> or{' '}
            <code className="bg-white/5 px-1 rounded">TWELVE_DATA_API_KEY</code> to your .env.local for live index prices.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {indices.map((idx) => (
          <div key={idx.symbol} className="card !p-4 hover:border-[var(--border-accent)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{idx.flag}</span>
                <div>
                  <p className="text-sm font-bold text-white">{idx.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{idx.region}</p>
                </div>
              </div>
              {idx.price > 0 && <ChangeBadge value={idx.changePercent} size="sm" />}
            </div>
            {idx.price > 0 ? (
              <div className="flex items-end justify-between">
                <p className="text-lg font-bold font-mono text-white">
                  {idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className={`text-xs font-mono ${idx.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <LuClock className="w-3 h-3" />
                <span>Awaiting data feed</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Commodities Table ───────────────────────────────────

function CommoditiesTable({ commodities }: { commodities: CommodityData[] }) {
  const hasData = commodities.some(c => c.price > 0);
  return (
    <div className="space-y-3">
      {!hasData && (
        <div className="card !p-4 border-yellow-500/20">
          <p className="text-xs text-yellow-400">
            💡 Configure stock data API keys in .env.local for live commodity prices.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {commodities.map((c) => (
          <div key={c.symbol} className="card !p-4 hover:border-[var(--border-accent)] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-bold text-white">{c.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">per {c.unit}</p>
              </div>
              {c.price > 0 && <ChangeBadge value={c.changePercent} size="sm" />}
            </div>
            {c.price > 0 ? (
              <p className="text-lg font-bold font-mono text-white">{fmtPrice(c.price)}</p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <LuClock className="w-3 h-3" />
                <span>Awaiting data feed</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trending Coins ──────────────────────────────────────

function TrendingList({ coins }: { coins: TrendingCoin[] }) {
  if (coins.length === 0) return <EmptyBlock label="Loading trending..." />;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {coins.map((coin, i) => (
        <div key={coin.id} className="card !p-4 hover:border-[var(--border-accent)] transition-all">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full" loading="lazy" />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center">
                <LuFlame className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">{coin.name}</p>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">
                {coin.symbol} · #{coin.market_cap_rank ?? '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[var(--text-muted)]">Score</p>
              <p className="text-sm font-bold text-orange-400">#{i + 1}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty Block ─────────────────────────────────────────

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="card !p-12 flex flex-col items-center justify-center text-center">
      <LuActivity className="w-8 h-8 text-[var(--text-muted)] mb-3 animate-pulse" />
      <p className="text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

// ── Global Stats Bar ────────────────────────────────────

function GlobalStatsBar({ global }: { global: any }) {
  if (!global) return null;
  const stats = [
    { label: 'Market Cap', value: fmt(global.total_market_cap_usd), change: global.market_cap_change_24h_pct },
    { label: '24h Volume', value: fmt(global.total_volume_24h_usd) },
    { label: 'BTC Dominance', value: `${global.btc_dominance.toFixed(1)}%` },
    { label: 'ETH Dominance', value: `${global.eth_dominance.toFixed(1)}%` },
    { label: 'Active Coins', value: fmtNum(global.active_cryptocurrencies, 0) },
    { label: 'Exchanges', value: global.markets.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="card !p-3 text-center">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{s.label}</p>
          <p className="text-base font-bold font-mono text-white mt-0.5">{s.value}</p>
          {s.change !== undefined && (
            <ChangeBadge value={s.change} size="sm" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Loading Skeleton ────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card !p-4">
            <div className="h-3 bg-white/5 rounded w-16 mx-auto mb-2" />
            <div className="h-5 bg-white/5 rounded w-20 mx-auto" />
          </div>
        ))}
      </div>
      <div className="card !p-0 overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="w-7 h-7 bg-white/5 rounded-full" />
            <div className="flex-1"><div className="h-4 bg-white/5 rounded w-32" /></div>
            <div className="h-4 bg-white/5 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────

function LiveMarketsPage() {
  const {
    crypto,
    forex,
    global,
    indices,
    commodities,
    trending,
    loading,
    error,
    lastUpdated,
    refetch,
  } = useLiveMarkets(30_000);

  const [tab, setTab] = useState<Tab>('crypto');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'rank' | 'price' | '24h' | '7d' | 'mcap'>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter & sort crypto
  const filteredCrypto = useMemo(() => {
    let list = [...crypto];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case 'rank': diff = a.market_cap_rank - b.market_cap_rank; break;
        case 'price': diff = b.current_price - a.current_price; break;
        case '24h': diff = b.price_change_percentage_24h - a.price_change_percentage_24h; break;
        case '7d':
          diff = (b.price_change_percentage_7d_in_currency ?? 0) - (a.price_change_percentage_7d_in_currency ?? 0);
          break;
        case 'mcap': diff = b.market_cap - a.market_cap; break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });

    return list;
  }, [crypto, search, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <LuChevronUp className="w-3 h-3 inline ml-0.5" />
      : <LuChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  // Count losers / gainers
  const gainers = crypto.filter(c => c.price_change_percentage_24h > 0).length;
  const losers = crypto.filter(c => c.price_change_percentage_24h < 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
              <LuGlobe2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Live Markets</h1>
              <p className="text-xs text-[var(--text-muted)]">
                Real-time worldwide financial data • Auto-refreshing every 30s
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Last updated */}
          {lastUpdated && (
            <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Updated {timeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={refetch}
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-white/5 hover:bg-white/10 transition-colors text-[var(--text-secondary)]"
            title="Refresh"
          >
            <LuRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick stats banner */}
      {global && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-white/5 overflow-x-auto text-xs">
          <span className="text-[var(--text-muted)] whitespace-nowrap">Global:</span>
          <span className="font-mono text-white whitespace-nowrap">MCap {fmt(global.total_market_cap_usd)}</span>
          <ChangeBadge value={global.market_cap_change_24h_pct} size="sm" />
          <span className="text-white/20">|</span>
          <span className="font-mono text-white whitespace-nowrap">BTC {global.btc_dominance.toFixed(1)}%</span>
          <span className="text-white/20">|</span>
          <span className="font-mono text-white whitespace-nowrap">ETH {global.eth_dominance.toFixed(1)}%</span>
          <span className="text-white/20">|</span>
          <span className="whitespace-nowrap">
            <span className="text-emerald-400">▲ {gainers}</span>
            <span className="text-[var(--text-muted)] mx-1">/</span>
            <span className="text-red-400">▼ {losers}</span>
          </span>
        </div>
      )}

      {loading && crypto.length === 0 ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Global Stats */}
          <GlobalStatsBar global={global} />

          {/* Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            <TabBtn active={tab === 'crypto'} label="Crypto" icon={LuBitcoin} count={crypto.length} onClick={() => setTab('crypto')} />
            <TabBtn active={tab === 'forex'} label="Forex" icon={LuDollarSign} count={forex.length} onClick={() => setTab('forex')} />
            <TabBtn active={tab === 'indices'} label="Indices" icon={LuBarChart3} count={indices.length} onClick={() => setTab('indices')} />
            <TabBtn active={tab === 'commodities'} label="Commodities" icon={LuCoins} count={commodities.length} onClick={() => setTab('commodities')} />
            <TabBtn active={tab === 'trending'} label="Trending" icon={LuFlame} count={trending.length} onClick={() => setTab('trending')} />
          </div>

          {/* ── CRYPTO TAB ── */}
          {tab === 'crypto' && (
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search coins..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-white/5 text-sm text-white placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2.5 rounded-lg border transition-colors ${
                      viewMode === 'table'
                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] border-white/5 text-[var(--text-muted)]'
                    }`}
                    title="Table view"
                  >
                    <LuBarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-2.5 rounded-lg border transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                        : 'bg-[var(--bg-elevated)] border-white/5 text-[var(--text-muted)]'
                    }`}
                    title="Card view"
                  >
                    <LuLineChart className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                /* Table View */
                <div className="card !p-0 overflow-hidden overflow-x-auto">
                  {/* Header */}
                  <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_1fr_100px] gap-3 px-4 py-2.5 bg-white/[0.02] text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-medium border-b border-white/5 sticky top-0">
                    <button onClick={() => toggleSort('rank')} className="text-center cursor-pointer hover:text-white transition-colors">#<SortIcon field="rank" /></button>
                    <span>Coin</span>
                    <button onClick={() => toggleSort('price')} className="text-right cursor-pointer hover:text-white transition-colors">Price<SortIcon field="price" /></button>
                    <button onClick={() => toggleSort('24h')} className="text-right cursor-pointer hover:text-white transition-colors">24h<SortIcon field="24h" /></button>
                    <button onClick={() => toggleSort('7d')} className="text-right cursor-pointer hover:text-white transition-colors">7d<SortIcon field="7d" /></button>
                    <button onClick={() => toggleSort('mcap')} className="text-right cursor-pointer hover:text-white transition-colors">Market Cap<SortIcon field="mcap" /></button>
                    <span className="text-right">7d Chart</span>
                  </div>
                  {/* Rows */}
                  <div className="max-h-[600px] overflow-y-auto">
                    {filteredCrypto.map((coin, i) => (
                      <CryptoRow key={coin.id} coin={coin} rank={i + 1} />
                    ))}
                    {filteredCrypto.length === 0 && (
                      <div className="py-8 text-center text-sm text-[var(--text-muted)]">
                        No coins match &ldquo;{search}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Card View */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredCrypto.map((coin) => (
                    <CryptoCard key={coin.id} coin={coin} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── FOREX TAB ── */}
          {tab === 'forex' && <ForexTable rates={forex} />}

          {/* ── INDICES TAB ── */}
          {tab === 'indices' && <IndicesTable indices={indices} />}

          {/* ── COMMODITIES TAB ── */}
          {tab === 'commodities' && <CommoditiesTable commodities={commodities} />}

          {/* ── TRENDING TAB ── */}
          {tab === 'trending' && <TrendingList coins={trending} />}

        </>
      )}

      {/* Error banner */}
      {error && (
        <div className="card !p-4 border-red-500/20">
          <p className="text-xs text-red-400">⚠ {error}</p>
        </div>
      )}
    </div>
  );
}

export default dynamic(() => Promise.resolve(LiveMarketsPage), { ssr: false });
