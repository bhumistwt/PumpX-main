/**
 * PumpX — Social Proof Live Feed Component
 *
 * Real-time ticker showing recent bets, market creations, and activity.
 * Auto-polls every 10 seconds for new activity.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { formatEther } from 'viem';
import { LuActivity, LuTrendingUp, LuTrendingDown, LuPlusCircle, LuZap } from 'react-icons/lu';

interface FeedItem {
  type: 'bet' | 'market_created';
  id: string;
  address: string;
  action: string;
  amount: string;
  market: string;
  marketAddress: string;
  ticker: string | null;
  timestamp: string;
}

interface SocialProofFeedProps {
  maxItems?: number;
  compact?: boolean;
  autoScroll?: boolean;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(weiStr: string): string {
  try {
    const eth = parseFloat(formatEther(BigInt(weiStr)));
    if (eth === 0) return '';
    return `${eth.toFixed(4)} ETH`;
  } catch {
    return '';
  }
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function FeedItemRow({ item, compact }: { item: FeedItem; compact: boolean }) {
  const isYes = item.action.includes('YES');
  const isNo = item.action.includes('NO');
  const isCreate = item.type === 'market_created';
  const amount = formatAmount(item.amount);

  const Icon = isCreate ? LuPlusCircle : isYes ? LuTrendingUp : LuTrendingDown;
  const color = isCreate ? 'text-blue-400' : isYes ? 'text-emerald-400' : 'text-red-400';
  const bg = isCreate ? 'bg-blue-400/5' : isYes ? 'bg-emerald-400/5' : 'bg-red-400/5';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 ${bg} rounded-lg animate-slide-in`}>
        <Icon className={`w-3 h-3 ${color} shrink-0`} />
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{shortAddress(item.address)}</span>
        <span className={`text-[10px] font-medium ${color}`}>{item.action}</span>
        {amount && <span className="text-[10px] text-white font-mono">{amount}</span>}
        <span className="text-[10px] text-[var(--text-muted)] truncate flex-1">
          {item.market.length > 35 ? item.market.slice(0, 35) + '...' : item.market}
        </span>
        <span className="text-[9px] text-[var(--text-muted)] shrink-0">{timeAgo(item.timestamp)}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 p-3 ${bg} border border-white/5 rounded-xl animate-slide-in`}>
      <div className={`w-8 h-8 rounded-lg ${bg} border border-white/10 flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white">{shortAddress(item.address)}</span>
          <span className={`text-xs font-medium ${color}`}>{item.action}</span>
          {amount && <span className="text-xs font-mono text-white">{amount}</span>}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{item.market}</p>
        {item.ticker && (
          <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            ${item.ticker}
          </span>
        )}
      </div>
      <span className="text-[10px] text-[var(--text-muted)] shrink-0">{timeAgo(item.timestamp)}</span>
    </div>
  );
}

export function SocialProofFeed({ maxItems = 15, compact = false, autoScroll = true }: SocialProofFeedProps) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed?limit=${maxItems}`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed || []);
      }
    } catch {
      // Silently fail — feed is non-critical
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    fetchFeed();
    if (!isLive) return;
    const interval = setInterval(fetchFeed, 10_000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchFeed, isLive]);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LuActivity className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Live Activity</h3>
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] text-emerald-400">LIVE</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setIsLive(prev => !prev)}
          className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
            isLive
              ? 'border-emerald-400/20 text-emerald-400 bg-emerald-400/5'
              : 'border-white/10 text-[var(--text-muted)] hover:text-white'
          }`}
        >
          {isLive ? 'Pause' : 'Resume'}
        </button>
      </div>

      {/* Feed */}
      <div ref={containerRef} className={`space-y-1.5 ${compact ? 'max-h-[300px]' : 'max-h-[500px]'} overflow-y-auto scrollbar-thin`}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LuZap className="w-5 h-5 text-[var(--text-muted)] animate-pulse" />
          </div>
        ) : feed.length === 0 ? (
          <div className="text-center py-8">
            <LuActivity className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-xs text-[var(--text-muted)]">No activity yet</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Be the first to create a market!</p>
          </div>
        ) : (
          feed.map((item) => (
            <FeedItemRow key={item.id + item.timestamp} item={item} compact={compact} />
          ))
        )}
      </div>
    </div>
  );
}

/** Compact inline ticker for navbar/headers */
export function FeedTicker() {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch('/api/feed?limit=5');
        if (res.ok) {
          const data = await res.json();
          setFeed(data.feed || []);
        }
      } catch {}
    };
    fetchFeed();
    const interval = setInterval(fetchFeed, 15_000);
    return () => clearInterval(interval);
  }, []);

  if (feed.length === 0) return null;

  return (
    <div className="overflow-hidden h-6 relative">
      <div className="animate-ticker flex flex-col">
        {feed.map((item, i) => {
          const isYes = item.action.includes('YES');
          const isCreate = item.type === 'market_created';
          const color = isCreate ? 'text-blue-400' : isYes ? 'text-emerald-400' : 'text-red-400';

          return (
            <div key={i} className="flex items-center gap-2 h-6 whitespace-nowrap">
              <span className="text-[10px] font-mono text-[var(--text-muted)]">{shortAddress(item.address)}</span>
              <span className={`text-[10px] font-medium ${color}`}>{item.action}</span>
              {item.ticker && <span className="text-[10px] text-[var(--accent-primary)]">${item.ticker}</span>}
              <span className="text-[10px] text-[var(--text-muted)]">{timeAgo(item.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
