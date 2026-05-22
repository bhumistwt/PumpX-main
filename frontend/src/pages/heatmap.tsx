/**
 * PumpX — Market Sentiment Heatmap Page
 *
 * Visual grid of markets colored by YES/NO ratio.
 * Green = bullish (high YES), Red = bearish (high NO), sized by volume.
 */

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  LuFlame,
  LuClock,
  LuTrendingUp,
  LuTrendingDown,
  LuBarChart3,
  LuActivity,
  LuRefreshCw,
  LuArrowRight,
} from 'react-icons/lu';

interface HeatmapMarket {
  address: string;
  question: string;
  ticker: string | null;
  tokenAddress: string;
  yesRatio: number;
  noRatio: number;
  totalVolume: number;
  betsCount: number;
  deadline: string;
  daysRemaining: number;
  hoursRemaining: number;
  isExpiring: boolean;
}

interface AggregateData {
  totalMarkets: number;
  overallSentiment: number;
  totalVolume: number;
  totalBets: number;
}

function getSentimentColor(yesRatio: number): string {
  if (yesRatio >= 75) return 'from-emerald-500/30 to-emerald-500/10 border-emerald-500/20';
  if (yesRatio >= 60) return 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/15';
  if (yesRatio >= 40) return 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/15';
  if (yesRatio >= 25) return 'from-red-500/20 to-red-500/5 border-red-500/15';
  return 'from-red-500/30 to-red-500/10 border-red-500/20';
}

function getSentimentLabel(yesRatio: number): { label: string; color: string } {
  if (yesRatio >= 75) return { label: 'Very Bullish', color: 'text-emerald-400' };
  if (yesRatio >= 60) return { label: 'Bullish', color: 'text-emerald-300' };
  if (yesRatio >= 40) return { label: 'Neutral', color: 'text-yellow-400' };
  if (yesRatio >= 25) return { label: 'Bearish', color: 'text-red-300' };
  return { label: 'Very Bearish', color: 'text-red-400' };
}

function HeatmapCell({ market }: { market: HeatmapMarket }) {
  const sentiment = getSentimentLabel(market.yesRatio);
  const gradient = getSentimentColor(market.yesRatio);

  return (
    <Link href={`/markets/view?address=${market.address}`}>
      <div className={`relative bg-gradient-to-br ${gradient} border rounded-xl p-4 hover:scale-[1.02] transition-all cursor-pointer group`}>
        {/* Expiring badge */}
        {market.isExpiring && (
          <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
            <LuClock className="w-2.5 h-2.5" />
            EXPIRING
          </div>
        )}

        {/* Ticker */}
        {market.ticker && (
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium mb-2">
            ${market.ticker}
          </span>
        )}

        {/* Question */}
        <h4 className="text-sm font-medium text-white leading-tight mb-3 line-clamp-2 group-hover:text-[var(--accent-primary)] transition-colors">
          {market.question}
        </h4>

        {/* Sentiment bar */}
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
            style={{ width: `${market.yesRatio}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1">
            <LuTrendingUp className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-mono">{market.yesRatio.toFixed(1)}%</span>
          </div>
          <span className={`font-medium ${sentiment.color}`}>{sentiment.label}</span>
          <div className="flex items-center gap-1">
            <span className="text-red-400 font-mono">{market.noRatio.toFixed(1)}%</span>
            <LuTrendingDown className="w-3 h-3 text-red-400" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] mt-2 pt-2 border-t border-white/5">
          <span>{market.totalVolume.toFixed(4)} ETH</span>
          <span>{market.betsCount} bets</span>
          <span>
            {market.daysRemaining > 0
              ? `${market.daysRemaining}d left`
              : `${market.hoursRemaining}h left`}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function HeatmapPage() {
  const [markets, setMarkets] = useState<HeatmapMarket[]>([]);
  const [aggregate, setAggregate] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'sentiment' | 'expiring'>('volume');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/markets/heatmap');
      if (res.ok) {
        const data = await res.json();
        setMarkets(data.markets);
        setAggregate(data.aggregate);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const sorted = useMemo(() => {
    const copy = [...markets];
    switch (sortBy) {
      case 'volume':
        return copy.sort((a, b) => b.totalVolume - a.totalVolume);
      case 'sentiment':
        return copy.sort((a, b) => Math.abs(b.yesRatio - 50) - Math.abs(a.yesRatio - 50));
      case 'expiring':
        return copy.sort((a, b) => a.daysRemaining * 24 + a.hoursRemaining - (b.daysRemaining * 24 + b.hoursRemaining));
    }
  }, [markets, sortBy]);

  const overallSentiment = aggregate ? getSentimentLabel(aggregate.overallSentiment) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 flex items-center justify-center">
            <LuFlame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Sentiment Heatmap</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time market sentiment across all active predictions
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate Stats */}
      {aggregate && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Overall Sentiment</p>
            <p className={`text-xl font-bold mt-1 ${overallSentiment?.color}`}>
              {aggregate.overallSentiment.toFixed(1)}%
            </p>
            <p className={`text-[10px] ${overallSentiment?.color}`}>{overallSentiment?.label}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Active Markets</p>
            <p className="text-xl font-bold mt-1 text-white">{aggregate.totalMarkets}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Volume</p>
            <p className="text-xl font-bold mt-1 text-white">{aggregate.totalVolume.toFixed(4)}</p>
            <p className="text-[10px] text-[var(--text-muted)]">ETH</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total Bets</p>
            <p className="text-xl font-bold mt-1 text-white">{aggregate.totalBets}</p>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Sort by:</span>
        {(['volume', 'sentiment', 'expiring'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              sortBy === s
                ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                : 'border-white/10 text-[var(--text-muted)] hover:text-white hover:border-white/20'
            }`}
          >
            {s === 'volume' && <LuBarChart3 className="w-3 h-3 inline mr-1" />}
            {s === 'sentiment' && <LuActivity className="w-3 h-3 inline mr-1" />}
            {s === 'expiring' && <LuClock className="w-3 h-3 inline mr-1" />}
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <LuRefreshCw className="w-3 h-3 inline mr-1" />
          Refresh
        </button>
      </div>

      {/* Heatmap Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card p-4 h-40 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 card">
          <LuFlame className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-medium text-white mb-1">No Active Markets</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">Create the first prediction market to see sentiment data</p>
          <Link href="/markets" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2">
            Create Market <LuArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((market) => (
            <HeatmapCell key={market.address} market={market} />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/30" />
          Very Bullish (&gt;75%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/15" />
          Bullish (60-75%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-500/15" />
          Neutral (40-60%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/15" />
          Bearish (25-40%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/30" />
          Very Bearish (&lt;25%)
        </span>
      </div>
    </div>
  );
}
