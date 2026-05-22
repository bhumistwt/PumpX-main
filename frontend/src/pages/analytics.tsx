import React, { useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { Market } from '../types/market';
import { LiveIndicator } from '../components/ui/primitives';

/* ── Helpers ──────────────────────────────────────── */
function formatNum(n: number, dec = 0): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(dec);
}

/* ── Mini Bar Chart ─────────────────────────────── */
function BarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-2">{label}</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--accent-primary)]/60 rounded-sm transition-all duration-500 min-h-[2px]"
              style={{ height: `${(v / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-[var(--text-muted)] mt-1 font-mono">
        <span>7d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/* ── Sentiment Gauge ─────────────────────────────── */
function SentimentGauge({ yesTotal, noTotal }: { yesTotal: number; noTotal: number }) {
  const total = yesTotal + noTotal || 1;
  const yesPct = (yesTotal / total) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-emerald-400 font-medium">Bullish {yesPct.toFixed(0)}%</span>
        <span className="text-red-400 font-medium">Bearish {(100 - yesPct).toFixed(0)}%</span>
      </div>
      <div className="h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden flex">
        <div className="bg-emerald-500 transition-all duration-700" style={{ width: `${yesPct}%` }} />
        <div className="bg-red-500 transition-all duration-700" style={{ width: `${100 - yesPct}%` }} />
      </div>
    </div>
  );
}

/* ── Activity feed item ──────────────────────────── */
function ActivityItem({ market, idx }: { market: Market; idx: number }) {
  const isActive = !market.resolved && market.deadline > Date.now();
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0 animate-fade-in" style={{ animationDelay: `${idx * 60}ms` }}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400 animate-pulse' : market.reached ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{market.question}</p>
        <p className="text-[10px] text-[var(--text-muted)] font-mono">
          {market.tokenSymbol} · {new Date(market.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span className={`badge text-[10px] border ${
        isActive ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' :
        market.reached ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
        'text-red-400 bg-red-400/10 border-red-400/20'
      }`}>
        {isActive ? 'Live' : market.reached ? 'YES' : 'NO'}
      </span>
    </div>
  );
}

/* ── Whale Tracker ───────────────────────────────── */
function WhaleTracker({ markets }: { markets: Market[] }) {
  // Simulated whale detection: markets with high total pools
  const topMarkets = [...markets]
    .sort((a, b) => (b.yesPool + b.noPool) - (a.yesPool + a.noPool))
    .slice(0, 5);

  return (
    <div className="space-y-2">
      {topMarkets.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">No whale activity detected</p>
      ) : topMarkets.map((m, i) => (
        <div key={m.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
          <span className="text-xs font-mono text-[var(--text-muted)] w-4">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">{m.question}</p>
            <p className="text-[10px] text-[var(--text-muted)] font-mono">{m.tokenSymbol}</p>
          </div>
          <span className="text-xs font-mono text-[var(--accent-primary)]">
            {((m.yesPool + m.noPool)).toFixed(2)} ETH
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────── */
export default function Analytics() {
  const { isConnected } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('prediction-markets');
    if (stored) {
      try { setMarkets(JSON.parse(stored)); } catch {}
    }
  }, []);

  const stats = useMemo(() => {
    const active = markets.filter(m => !m.resolved && m.deadline > Date.now());
    const resolved = markets.filter(m => m.resolved);
    const yesWins = resolved.filter(m => m.reached);
    const totalYesPool = markets.reduce((s, m) => s + m.yesPool, 0);
    const totalNoPool = markets.reduce((s, m) => s + m.noPool, 0);
    const uniqueTokens = new Set(markets.map(m => m.tokenSymbol)).size;

    // Generate mock 7-day data (in prod this comes from Supabase)
    const dailyCreated = Array.from({ length: 7 }, (_, i) => {
      const dayStart = Date.now() - (6 - i) * 86400000;
      const dayEnd = dayStart + 86400000;
      return markets.filter(m => m.createdAt >= dayStart && m.createdAt < dayEnd).length;
    });

    return {
      total: markets.length,
      active: active.length,
      resolved: resolved.length,
      accuracy: resolved.length > 0 ? (yesWins.length / resolved.length * 100) : 0,
      totalYesPool,
      totalNoPool,
      uniqueTokens,
      dailyCreated,
    };
  }, [markets]);

  const recentMarkets = useMemo(
    () => [...markets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [markets]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Protocol Analytics</h1>
            <LiveIndicator />
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Real-time intelligence from on-chain prediction markets
          </p>
        </div>
        <Link href="/markets/view" className="btn-secondary text-sm">
          View Markets →
        </Link>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Markets', value: stats.total.toString(), sub: `${stats.active} active`, color: 'text-white' },
          { label: 'Unique Tokens', value: stats.uniqueTokens.toString(), sub: 'tracked assets', color: 'text-[var(--accent-primary)]' },
          { label: 'Resolution Rate', value: `${stats.accuracy.toFixed(0)}%`, sub: `${stats.resolved} resolved`, color: 'text-emerald-400' },
          { label: 'Total Volume', value: `${formatNum(stats.totalYesPool + stats.totalNoPool, 2)}`, sub: 'ETH pooled', color: 'text-blue-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="card !p-4">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Market Creation Trend */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Market Creation Trend (7d)</h2>
          <BarChart data={stats.dailyCreated} label="" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono text-white">{stats.dailyCreated.reduce((a, b) => a + b, 0)}</p>
              <p className="text-[10px] text-[var(--text-muted)]">7d Total</p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono text-emerald-400">{(stats.dailyCreated.reduce((a, b) => a + b, 0) / 7).toFixed(1)}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Daily Avg</p>
            </div>
            <div className="bg-[var(--bg-elevated)] rounded-lg p-3 text-center">
              <p className="text-lg font-bold font-mono text-blue-400">{Math.max(...stats.dailyCreated)}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Peak Day</p>
            </div>
          </div>
        </div>

        {/* Sentiment Overview */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Market Sentiment</h2>
          <SentimentGauge yesTotal={stats.totalYesPool} noTotal={stats.totalNoPool} />
          <div className="mt-5 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">YES Pool</span>
              <span className="text-emerald-400 font-mono">{stats.totalYesPool.toFixed(4)} ETH</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">NO Pool</span>
              <span className="text-red-400 font-mono">{stats.totalNoPool.toFixed(4)} ETH</span>
            </div>
            <div className="flex justify-between text-xs border-t border-white/5 pt-3">
              <span className="text-[var(--text-muted)]">Combined</span>
              <span className="text-white font-mono font-medium">{(stats.totalYesPool + stats.totalNoPool).toFixed(4)} ETH</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5">
            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-3">Market Accuracy</h3>
            <div className="relative h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-700"
                style={{ width: `${stats.accuracy}%` }} />
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right font-mono">{stats.accuracy.toFixed(1)}% accurate</p>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <LiveIndicator />
          </div>
          {recentMarkets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">No activity yet</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
              {recentMarkets.map((m, i) => (
                <ActivityItem key={m.id} market={m} idx={i} />
              ))}
            </div>
          )}
        </div>

        {/* Whale Tracker */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Whale Tracker</h2>
            <span className="badge text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/20">Top Volume</span>
          </div>
          <WhaleTracker markets={markets} />

          <div className="mt-6 pt-4 border-t border-white/5">
            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-3">On-Chain Transparency</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-elevated)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-muted)]">Contracts Deployed</p>
                <p className="text-lg font-bold font-mono text-white mt-0.5">{markets.filter(m => m.marketContract).length}</p>
              </div>
              <div className="bg-[var(--bg-elevated)] rounded-lg p-3">
                <p className="text-xs text-[var(--text-muted)]">Network</p>
                <p className="text-lg font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Base
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
