/**
 * PumpX — Stock Intelligence Page
 *
 * Full-featured stock data intelligence dashboard:
 *   - Watchlist of trending stocks
 *   - Search + auto-complete
 *   - Price chart with history
 *   - Fundamentals panel
 *   - Linked prediction markets
 *   - Sector filter
 *   - Market heatmap
 *   - Sentiment vs price correlation
 */

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Market } from '../types/market';
import { LiveIndicator } from '../components/ui/primitives';
import {
  StockPriceTicker,
  PriceChart,
  VolumeBars,
  StockQuoteCard,
  HeatmapCell,
  SentimentVsPrice,
  TickerPill,
  Sparkline,
} from '../components/ui/stockWidgets';
import {
  useStockQuote,
  useStockHistory,
  useStockOverview,
  useStockSearch,
  useMultiQuote,
} from '../hooks/useStockData';
import type { StockOverview } from '../lib/stockData';
import {
  LuSearch,
  LuLineChart,
  LuBuilding2,
  LuDollarSign,
  LuTrendingUp,
  LuTrendingDown,
  LuBarChart3,
  LuTarget,
  LuArrowRight,
  LuX,
} from 'react-icons/lu';
import PumpScoreLeaderboard from '../components/PumpScoreLeaderboard';

// ── Default watchlist (demo tickers) ───────────────────
const DEFAULT_WATCHLIST = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'BTC-USD'];

const SECTOR_FILTERS = ['All', 'Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Crypto'];

// ── Fundamentals Panel ─────────────────────────────────

function FundamentalsPanel({ overview }: { overview: StockOverview | null }) {
  if (!overview) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  const rows = [
    { label: 'Market Cap', value: overview.marketCap > 0 ? `$${(overview.marketCap / 1e9).toFixed(1)}B` : '—' },
    { label: 'P/E Ratio', value: overview.peRatio > 0 ? overview.peRatio.toFixed(2) : '—' },
    { label: 'EPS', value: overview.eps !== 0 ? `$${overview.eps.toFixed(2)}` : '—' },
    { label: 'Div Yield', value: overview.dividendYield > 0 ? `${(overview.dividendYield * 100).toFixed(2)}%` : '—' },
    { label: '52W High', value: overview.weekHigh52 > 0 ? `$${overview.weekHigh52.toFixed(2)}` : '—' },
    { label: '52W Low', value: overview.weekLow52 > 0 ? `$${overview.weekLow52.toFixed(2)}` : '—' },
    { label: 'Sector', value: overview.sector || '—' },
    { label: 'Exchange', value: overview.exchange || '—' },
  ];

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.label} className="flex justify-between text-xs">
          <span className="text-[var(--text-muted)]">{r.label}</span>
          <span className="text-white font-mono">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function IntelligencePage() {
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('All');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [historyDays, setHistoryDays] = useState(30);

  // Load markets from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('prediction-markets');
    if (stored) {
      try { setMarkets(JSON.parse(stored)); } catch {}
    }
  }, []);

  // Extract tickers linked in markets
  const marketLinkedTickers = useMemo(() => {
    const s = new Set<string>();
    markets.forEach(m => { if (m.stockTicker) s.add(m.stockTicker); });
    return Array.from(s);
  }, [markets]);

  // Combine watchlist + market tickers (dedup)
  const allTickers = useMemo(() => {
    const combined = new Set([...DEFAULT_WATCHLIST, ...marketLinkedTickers]);
    return Array.from(combined);
  }, [marketLinkedTickers]);

  // Data hooks
  const { data: quote, loading: quoteLoading } = useStockQuote(selectedTicker);
  const { data: history, loading: histLoading } = useStockHistory(selectedTicker, historyDays);
  const { data: overview, loading: overviewLoading } = useStockOverview(selectedTicker);
  const { results: searchResults, loading: searching } = useStockSearch(searchQuery);
  const { quotes: watchlistQuotes, loading: watchlistLoading } = useMultiQuote(allTickers, 120_000);

  // Markets linked to selected ticker
  const linkedMarkets = useMemo(
    () => markets.filter(m => m.stockTicker === selectedTicker),
    [markets, selectedTicker]
  );

  // Sector filtering (simple: filter by overview sector of selected)
  const filteredTickers = useMemo(() => {
    if (sectorFilter === 'All') return allTickers;
    // In a real app, we'd have sector data for all tickers; for demo, filter by first letter or tag
    return allTickers; // passthrough for demo — needs full overview data per ticker
  }, [allTickers, sectorFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      {/* PumpScore Leaderboard */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">PumpScore Leaderboard</h2>
          <p className="text-sm text-[var(--text-muted)]">Top tokens ranked by ML score</p>
        </div>
        <PumpScoreLeaderboard />
      </div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Stock Intelligence</h1>
            <LiveIndicator />
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Real-time market data powering prediction intelligence
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticker or company…"
            className="input w-full pl-9 text-sm"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
            </div>
          )}

          {/* Search dropdown */}
          {searchResults.length > 0 && searchQuery.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg shadow-xl max-h-64 overflow-y-auto">
              {searchResults.slice(0, 8).map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => { setSelectedTicker(r.symbol); setSearchQuery(''); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors border-b border-white/5 last:border-0"
                >
                  <div>
                    <span className="text-sm font-semibold text-[var(--accent-primary)]">{r.symbol}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-2 truncate">{r.name}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-2">{r.type} · {r.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sector Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SECTOR_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setSectorFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              sectorFilter === s
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-white/5 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main Layout: Left (Chart + Detail) + Right (Watchlist) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* ── Left: Selected Stock Detail ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Quote Header */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedTicker}</h2>
                  {overview?.name && (
                    <span className="text-sm text-[var(--text-muted)]">{overview.name}</span>
                  )}
                  {overview?.sector && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-white/5">
                      {overview.sector}
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <StockPriceTicker quote={quote} size="lg" />
                </div>
                {quote && (
                  <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)] font-mono">
                    <span>O: ${quote.open.toFixed(2)}</span>
                    <span>H: ${quote.high.toFixed(2)}</span>
                    <span>L: ${quote.low.toFixed(2)}</span>
                    <span>Vol: {(quote.volume / 1e6).toFixed(1)}M</span>
                  </div>
                )}
              </div>

              {/* Time range selector */}
              <div className="flex gap-1">
                {[
                  { label: '7D', days: 7 },
                  { label: '1M', days: 30 },
                  { label: '3M', days: 90 },
                  { label: '6M', days: 180 },
                  { label: '1Y', days: 365 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    onClick={() => setHistoryDays(days)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      historyDays === days
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        : 'text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Chart */}
            {histLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--accent-primary)] rounded-full animate-spin" />
              </div>
            ) : (
              <PriceChart history={history} height={200} />
            )}

            {/* Volume */}
            {history.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] text-[var(--text-muted)] mb-1">Volume</p>
                <VolumeBars history={history} />
              </div>
            )}
          </div>

          {/* Fundamentals + Linked Markets Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fundamentals */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <LuBuilding2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold text-white">Fundamentals</h3>
              </div>
              <FundamentalsPanel overview={overview} />
              {overview?.description && (
                <p className="text-[10px] text-[var(--text-muted)] mt-4 pt-3 border-t border-white/5 line-clamp-3">
                  {overview.description}
                </p>
              )}
            </div>

            {/* Linked Prediction Markets */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LuTarget className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Linked Markets</h3>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">{linkedMarkets.length} markets</span>
              </div>

              {linkedMarkets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-muted)] mb-3">No prediction markets linked to {selectedTicker}</p>
                  <Link href="/markets" className="btn-primary text-xs px-4 py-2">
                    Create Market →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedMarkets.slice(0, 4).map(market => {
                    const totalBets = market.yesPool + market.noPool;
                    const sentiment = totalBets > 0 ? (market.yesPool / totalBets) * 100 : 50;
                    const isActive = !market.resolved && market.deadline > Date.now();
                    return (
                      <div key={market.id} className="p-3 rounded-lg bg-[var(--bg-primary)] border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-white truncate flex-1">{market.question}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ml-2 ${
                            isActive ? 'text-emerald-400 bg-emerald-400/10' : 'text-[var(--text-muted)] bg-white/5'
                          }`}>
                            {isActive ? 'LIVE' : 'Ended'}
                          </span>
                        </div>
                        {/* Sentiment bar */}
                        <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden flex mt-2">
                          <div className="bg-emerald-500" style={{ width: `${sentiment}%` }} />
                          <div className="bg-red-500" style={{ width: `${100 - sentiment}%` }} />
                        </div>
                        <div className="flex justify-between text-[9px] mt-1">
                          <span className="text-emerald-400">{sentiment.toFixed(0)}% YES</span>
                          <span className="text-red-400">{(100 - sentiment).toFixed(0)}% NO</span>
                        </div>
                        {/* Accuracy check for resolved markets */}
                        {market.resolved && quote && market.stockPriceAtCreation && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-[var(--text-muted)]">Price at creation</span>
                              <span className="text-white font-mono">${market.stockPriceAtCreation.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-[var(--text-muted)]">Current price</span>
                              <span className="text-white font-mono">${quote.price.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-[var(--text-muted)]">Change since creation</span>
                              <span className={`font-mono ${quote.price >= market.stockPriceAtCreation ? 'text-emerald-400' : 'text-red-400'}`}>
                                {((quote.price - market.stockPriceAtCreation) / market.stockPriceAtCreation * 100).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sentiment vs Price correlation for selected stock */}
          {quote && linkedMarkets.length > 0 && (() => {
            const allBets = linkedMarkets.reduce((acc, m) => acc + m.yesPool + m.noPool, 0);
            const allYes = linkedMarkets.reduce((acc, m) => acc + m.yesPool, 0);
            const sentiment = allBets > 0 ? (allYes / allBets) * 100 : 50;
            return (
              <SentimentVsPrice
                symbol={selectedTicker}
                marketSentiment={sentiment}
                priceChange={quote.changePercent}
              />
            );
          })()}
        </div>

        {/* ── Right: Watchlist ── */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Watchlist</h3>
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
              {filteredTickers.map(ticker => {
                const q = watchlistQuotes[ticker];
                const isSelected = ticker === selectedTicker;
                const isLinked = marketLinkedTickers.includes(ticker);

                return (
                  <button
                    key={ticker}
                    onClick={() => setSelectedTicker(ticker)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20'
                        : 'hover:bg-[var(--bg-elevated)] border border-transparent'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white">{ticker}</span>
                        {isLinked && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" title="Linked to market" />
                        )}
                      </div>
                      {q && (
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          ${q.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {q && (
                      <span className={`text-[10px] font-mono ${q.changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                      </span>
                    )}
                    {!q && !watchlistLoading && (
                      <span className="text-[10px] text-[var(--text-muted)]">—</span>
                    )}
                    {!q && watchlistLoading && (
                      <div className="w-3 h-3 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Market Heatmap */}
          {Object.keys(watchlistQuotes).length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Heatmap</h3>
              <div className="grid grid-cols-2 gap-2">
                {filteredTickers.slice(0, 8).map(ticker => {
                  const q = watchlistQuotes[ticker];
                  if (!q) return null;
                  return (
                    <HeatmapCell
                      key={ticker}
                      symbol={ticker}
                      changePercent={q.changePercent}
                      onClick={() => setSelectedTicker(ticker)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Link */}
          <Link href="/markets" className="card p-4 flex items-center justify-between hover:border-[var(--border-accent)] transition-all group block">
            <div>
              <p className="text-xs font-medium text-white">Create Market</p>
              <p className="text-[10px] text-[var(--text-muted)]">Link a stock to a prediction</p>
            </div>
            <LuArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
