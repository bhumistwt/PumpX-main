/**
 * PumpX — Stock Intelligence UI Components
 *
 * Reusable components for displaying stock data alongside prediction markets.
 * All components follow the existing design system (CSS variables, card class, etc.)
 */

import React, { useMemo } from 'react';
import type { StockQuote, StockHistoryPoint } from '../../lib/stockData';

// ── Stock Price Ticker ─────────────────────────────────
// Compact inline price display for embedding in market cards

export function StockPriceTicker({ quote, size = 'md' }: { quote: StockQuote | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!quote) {
    return <span className="text-[var(--text-muted)] text-sm animate-pulse">Loading…</span>;
  }

  const isPositive = quote.change >= 0;
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  }[size];

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`font-mono font-bold text-white ${sizeClasses}`}>
        ${quote.price.toFixed(2)}
      </span>
      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
        isPositive
          ? 'text-emerald-400 bg-emerald-400/10'
          : 'text-red-400 bg-red-400/10'
      }`}>
        {isPositive ? '▲' : '▼'} {Math.abs(quote.changePercent).toFixed(2)}%
      </span>
    </div>
  );
}

// ── Mini Sparkline Chart ───────────────────────────────
// SVG-based sparkline for inline price history

export function Sparkline({
  data,
  width = 120,
  height = 40,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [data, width, height]);

  if (data.length < 2) return null;

  const trend = data[data.length - 1] >= data[0];
  const lineColor = color || (trend ? '#10b981' : '#ef4444');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sp-${lineColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${path} L${width},${height} L0,${height} Z`}
        fill={`url(#sp-${lineColor})`}
      />
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={width} cy={lastY} r={2.5} fill={lineColor} />;
      })()}
    </svg>
  );
}

// ── Price Chart ────────────────────────────────────────
// Larger chart for the stock detail/intelligence page

export function PriceChart({
  history,
  height = 200,
}: {
  history: StockHistoryPoint[];
  height?: number;
}) {
  const closes = history.map(h => h.close);

  if (closes.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-[var(--text-muted)]" style={{ height }}>
        No price data available
      </div>
    );
  }

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const trend = closes[closes.length - 1] >= closes[0];

  // Build SVG path
  const w = 100; // percentage width
  const points = closes.map((v, i) => {
    const x = (i / (closes.length - 1)) * w;
    const y = 100 - ((v - min) / range) * 90 - 5;
    return `${x},${y}`;
  });

  const pathD = `M${points.join(' L')}`;
  const fillD = `${pathD} L${w},100 L0,100 Z`;
  const lineColor = trend ? '#10b981' : '#ef4444';

  // Calculate axis labels
  const yLabels = [min, min + range * 0.25, min + range * 0.5, min + range * 0.75, max];
  const xLabels = history.length > 4
    ? [history[0], history[Math.floor(history.length / 2)], history[history.length - 1]]
    : history;

  return (
    <div style={{ height }}>
      {/* Y-axis labels */}
      <div className="flex h-full gap-2">
        <div className="flex flex-col justify-between text-[9px] font-mono text-[var(--text-muted)] py-1 w-12 text-right shrink-0">
          {yLabels.reverse().map((v, i) => (
            <span key={i}>${v.toFixed(2)}</span>
          ))}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative">
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="border-b border-white/5 w-full" />
            ))}
          </div>

          <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={fillD} fill="url(#priceGrad)" />
            <path d={pathD} fill="none" stroke={lineColor} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
          </svg>

          {/* X-axis labels */}
          <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)] mt-1">
            {xLabels.map((h, i) => (
              <span key={i}>{h.date.slice(5)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Volume Bars ────────────────────────────────────────

export function VolumeBars({ history }: { history: StockHistoryPoint[] }) {
  if (history.length === 0) return null;
  const maxVol = Math.max(...history.map(h => h.volume));

  return (
    <div className="flex items-end gap-px h-12">
      {history.slice(-30).map((h, i) => {
        const pct = (h.volume / maxVol) * 100;
        const isGreen = h.close >= h.open;
        return (
          <div
            key={i}
            className={`flex-1 rounded-t-sm transition-all ${isGreen ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
            style={{ height: `${pct}%`, minHeight: 2 }}
            title={`${h.date}: ${h.volume.toLocaleString()}`}
          />
        );
      })}
    </div>
  );
}

// ── Stock Quote Card ───────────────────────────────────
// Full card for displaying a stock quote with sparkline

export function StockQuoteCard({
  quote,
  history,
  onClick,
}: {
  quote: StockQuote | null;
  history?: number[];
  onClick?: () => void;
}) {
  if (!quote) {
    return (
      <div className="card !p-4 animate-pulse">
        <div className="h-4 bg-white/5 rounded w-16 mb-2" />
        <div className="h-6 bg-white/5 rounded w-24 mb-1" />
        <div className="h-3 bg-white/5 rounded w-20" />
      </div>
    );
  }

  const isPositive = quote.change >= 0;

  return (
    <div
      className={`card !p-4 hover:border-[var(--border-accent)] transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--accent-primary)] tracking-wide">{quote.symbol}</p>
          <p className="text-lg font-bold font-mono text-white mt-0.5">${quote.price.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{quote.change.toFixed(2)}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
            }`}>
              {isPositive ? '▲' : '▼'} {Math.abs(quote.changePercent).toFixed(2)}%
            </span>
          </div>
        </div>
        {history && history.length > 1 && (
          <Sparkline data={history} width={80} height={36} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-3 pt-2 border-t border-white/5 font-mono">
        <span>H: ${quote.high.toFixed(2)}</span>
        <span>L: ${quote.low.toFixed(2)}</span>
        <span>Vol: {(quote.volume / 1e6).toFixed(1)}M</span>
      </div>
    </div>
  );
}

// ── Market Heatmap Cell ────────────────────────────────

export function HeatmapCell({
  symbol,
  changePercent,
  onClick,
}: {
  symbol: string;
  changePercent: number;
  onClick?: () => void;
}) {
  // Map change to color intensity
  const absChange = Math.min(Math.abs(changePercent), 10);
  const intensity = absChange / 10;
  const isPositive = changePercent >= 0;

  const bg = isPositive
    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})`
    : `rgba(239, 68, 68, ${0.1 + intensity * 0.5})`;

  return (
    <div
      className="rounded-lg p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:ring-1 hover:ring-white/10 transition-all"
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      <span className="text-xs font-bold text-white">{symbol}</span>
      <span className={`text-[10px] font-mono mt-0.5 ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

// ── Sentiment vs Price Indicator ───────────────────────
// Shows prediction market sentiment alongside actual stock price direction

export function SentimentVsPrice({
  marketSentiment,
  priceChange,
  symbol,
}: {
  marketSentiment: number; // 0-100 (% bullish)
  priceChange: number;     // actual price change %
  symbol: string;
}) {
  const priceBullish = priceChange >= 0;
  const marketBullish = marketSentiment >= 50;
  const aligned = priceBullish === marketBullish;

  return (
    <div className="bg-[var(--bg-elevated)] rounded-lg p-4 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[var(--text-muted)]">{symbol} — Sentiment vs Price</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          aligned
            ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
            : 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
        }`}>
          {aligned ? '✓ Aligned' : '⚡ Divergent'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Market Sentiment */}
        <div>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Market Prediction</p>
          <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden flex">
            <div className="bg-emerald-500" style={{ width: `${marketSentiment}%` }} />
            <div className="bg-red-500" style={{ width: `${100 - marketSentiment}%` }} />
          </div>
          <div className="flex justify-between text-[9px] mt-1">
            <span className="text-emerald-400">{marketSentiment.toFixed(0)}% Bull</span>
            <span className="text-red-400">{(100 - marketSentiment).toFixed(0)}% Bear</span>
          </div>
        </div>

        {/* Actual Price */}
        <div>
          <p className="text-[10px] text-[var(--text-muted)] mb-1">Actual Price</p>
          <div className={`text-lg font-mono font-bold ${priceBullish ? 'text-emerald-400' : 'text-red-400'}`}>
            {priceBullish ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
          <p className="text-[9px] text-[var(--text-muted)]">
            {priceBullish ? 'Trending Up' : 'Trending Down'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Stock Ticker Pill ──────────────────────────────────
// Small badge showing a stock symbol with live price

export function TickerPill({ symbol, price, changePercent }: { symbol: string; price?: number; changePercent?: number }) {
  const isPositive = (changePercent ?? 0) >= 0;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-elevated)] border border-white/5 text-xs">
      <span className="font-semibold text-[var(--accent-primary)]">{symbol}</span>
      {price !== undefined && (
        <span className="font-mono text-white">${price.toFixed(2)}</span>
      )}
      {changePercent !== undefined && (
        <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'}{Math.abs(changePercent).toFixed(1)}%
        </span>
      )}
    </span>
  );
}
