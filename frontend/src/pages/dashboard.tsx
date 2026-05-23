import React, { useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { StatCard, LiveIndicator, EmptyState, Badge } from '../components/ui/primitives';
import { StockQuoteCard, HeatmapCell, SentimentVsPrice } from '../components/ui/stockWidgets';
import { useMultiQuote, useStockHistory } from '../hooks/useStockData';
import { LuTrendingUp, LuBarChart3, LuActivity, LuWallet, LuPlus, LuArrowRight, LuLineChart } from 'react-icons/lu';
import { formatEther } from 'viem';
import { XPBar } from '../components/gamification/XPBar';
import { StreakCounter } from '../components/gamification/StreakCounter';
import { DailyChallenges } from '../components/gamification/DailyChallenges';
import { SeasonBanner } from '../components/gamification/SeasonBanner';
import { SocialProofFeed } from '../components/SocialProofFeed';
import { marketsApi, type MarketData } from '../lib/apiClient';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    marketsApi.list({ page: 1, limit: 50 })
      .then((res) => setMarkets(res.markets))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, []);

  const activeMarkets = markets.filter(m => !m.resolved && new Date(m.deadline).getTime() > Date.now());
  const resolvedMarkets = markets.filter(m => m.resolved);

  // Stock intelligence — in production, tickers come from market metadata
  // For now, extract from question text as a heuristic
  const linkedTickers = useMemo(() => {
    const tickerPattern = /\$([A-Z]{1,5})\b/g;
    const tickers = new Set<string>();
    markets.forEach(m => {
      const matches = m.question?.matchAll(tickerPattern);
      if (matches) for (const match of matches) tickers.add(match[1]);
    });
    return Array.from(tickers);
  }, [markets]);

  const { quotes: stockQuotes, loading: quotesLoading } = useMultiQuote(linkedTickers, 60_000);

  // Recent activity — sort by creation date
  const recentMarkets = [...markets].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <EmptyState
          title="Connect Your Wallet"
          description="Connect your wallet to view your dashboard, track positions, and manage markets."
          action={
            <ConnectButton.Custom>
              {({ mounted, openConnectModal }) => {
                if (!mounted) return null;

                return (
                  <button
                    onClick={openConnectModal}
                    className="btn-primary inline-flex items-center gap-2 px-5 py-3"
                  >
                    <LuWallet className="w-4 h-4" />
                    Connect Wallet
                  </button>
                );
              }}
            </ConnectButton.Custom>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Dashboard
            <LiveIndicator />
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Your portfolio overview and market intelligence
          </p>
        </div>
        <Link href="/markets">
          <button className="btn-primary flex items-center gap-2">
            <LuPlus className="w-4 h-4" /> New Market
          </button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Markets"
          value={activeMarkets.length.toString()}
          icon={<LuActivity className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          label="Resolved Markets"
          value={resolvedMarkets.length.toString()}
          icon={<LuBarChart3 className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          label="Total Markets"
          value={markets.length.toString()}
          icon={<LuTrendingUp className="w-5 h-5" />}
          loading={loading}
        />
        <StatCard
          label="Connected"
          value={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '—'}
          icon={<LuWallet className="w-5 h-5" />}
          loading={loading}
        />
      </div>

      {/* ── Gamification Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <XPBar showRank className="lg:col-span-1" />
        <StreakCounter className="lg:col-span-1" />
        <DailyChallenges className="lg:col-span-1" />
        <SeasonBanner className="lg:col-span-1" />
      </div>

      {/* ── Live Activity Feed ── */}
      <div className="card p-6">
        <SocialProofFeed compact maxItems={5} />
      </div>

      {/* ── Stock Intelligence Panel ── */}
      {linkedTickers.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <LuLineChart className="w-4 h-4 text-[var(--accent-primary)]" />
              <h2 className="font-semibold text-[var(--text-primary)]">Stock Intelligence</h2>
              <LiveIndicator />
            </div>
            <Link href="/intelligence" className="text-xs text-[var(--accent-primary)] hover:underline">
              Full View →
            </Link>
          </div>

          {/* Stock Quote Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {linkedTickers.slice(0, 6).map((ticker) => (
              <StockQuoteCard
                key={ticker}
                quote={stockQuotes[ticker] || null}
              />
            ))}
          </div>

          {/* Sentiment vs Price mini-cards */}
          {linkedTickers.slice(0, 3).map((ticker) => {
            const quote = stockQuotes[ticker];
            if (!quote) return null;
            return (
              <SentimentVsPrice
                key={ticker}
                symbol={ticker}
                marketSentiment={50}
                priceChange={quote.changePercent}
              />
            );
          })}

          {/* Mini Heatmap */}
          {linkedTickers.length > 2 && Object.keys(stockQuotes).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs text-[var(--text-muted)] mb-2">Market Heatmap</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {linkedTickers.map((ticker) => {
                  const q = stockQuotes[ticker];
                  if (!q) return null;
                  return (
                    <HeatmapCell
                      key={ticker}
                      symbol={ticker}
                      changePercent={q.changePercent}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two Column: Recent Markets + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Markets */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--text-primary)]">Recent Markets</h2>
            <Link href="/markets/view" className="text-sm text-[var(--accent-primary)] hover:underline flex items-center gap-1">
              View All <LuArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentMarkets.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] py-8 text-center">No markets created yet</p>
          ) : (
            <div className="space-y-3">
              {recentMarkets.map((market) => (
                <div key={market.contractAddress} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{market.question || 'Market'}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {market.contractAddress.slice(0, 8)}… · Created {new Date(market.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {market.resolved ? (
                      market.reached ? <Badge variant="success">YES Won</Badge> : <Badge variant="danger">NO Won</Badge>
                    ) : new Date(market.deadline).getTime() > Date.now() ? (
                      <Badge variant="active">Active</Badge>
                    ) : (
                      <Badge variant="warning">Expired</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-[var(--text-primary)]">Quick Actions</h2>

          <Link href="/markets" className="block">
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LuPlus className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                  <p className="font-medium text-sm">Create Market</p>
                  <p className="text-xs text-[var(--text-muted)]">Deploy a new prediction market</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/markets/view" className="block">
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/30 hover:bg-[var(--accent-secondary)]/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-secondary)]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LuTrendingUp className="w-5 h-5 text-[var(--accent-secondary)]" />
                </div>
                <div>
                  <p className="font-medium text-sm">Trade Markets</p>
                  <p className="text-xs text-[var(--text-muted)]">Bet on existing markets</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/analytics" className="block">
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LuBarChart3 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">View Analytics</p>
                  <p className="text-xs text-[var(--text-muted)]">Protocol metrics & insights</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/heatmap" className="block">
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] hover:border-orange-500/30 hover:bg-orange-500/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LuActivity className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Sentiment Heatmap</p>
                  <p className="text-xs text-[var(--text-muted)]">Visual market sentiment</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/hedge" className="block">
            <div className="p-4 rounded-lg border border-[var(--border-subtle)] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <LuWallet className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">Portfolio Hedge</p>
                  <p className="text-xs text-[var(--text-muted)]">AI-powered risk management</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Protocol Status */}
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] mb-3">Protocol Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Network</span>
                <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Base
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Contracts</span>
                <span className="text-[var(--text-primary)]">Verified</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">Uptime</span>
                <span className="text-emerald-400">99.9%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
