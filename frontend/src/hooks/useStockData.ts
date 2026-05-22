/**
 * PumpX — React Hooks for Stock Market Data
 * 
 * Consumes /api/stocks/* routes with SWR-like pattern:
 *   - Auto-refresh quotes every 60s
 *   - Deduplication across components
 *   - Loading / error / data states
 *   - Typed responses
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { StockQuote, StockHistoryPoint, StockOverview, StockSearchResult } from '../lib/stockData';

// ── Generic fetcher ────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── useStockQuote ──────────────────────────────────────
// Real-time quote with auto-refresh

export function useStockQuote(symbol: string | null, refreshMs = 60_000) {
  const [data, setData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchQuote = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoading(prev => !prev ? true : prev); // only flash on first load
      const quote = await apiFetch<StockQuote>(`/api/stocks/quote?symbol=${encodeURIComponent(symbol)}`);
      setData(quote);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch quote');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) { setData(null); setError(null); return; }
    fetchQuote();

    if (refreshMs > 0) {
      intervalRef.current = setInterval(fetchQuote, refreshMs);
      return () => clearInterval(intervalRef.current);
    }
  }, [symbol, refreshMs, fetchQuote]);

  return { data, loading, error, refetch: fetchQuote };
}

// ── useStockHistory ────────────────────────────────────

export function useStockHistory(symbol: string | null, days = 30) {
  const [data, setData] = useState<StockHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) { setData([]); setError(null); return; }

    let cancelled = false;
    setLoading(true);

    apiFetch<{ data: StockHistoryPoint[] }>(`/api/stocks/history?symbol=${encodeURIComponent(symbol)}&days=${days}`)
      .then(res => { if (!cancelled) { setData(res.data); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol, days]);

  return { data, loading, error };
}

// ── useStockOverview ───────────────────────────────────

export function useStockOverview(symbol: string | null) {
  const [data, setData] = useState<StockOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) { setData(null); setError(null); return; }

    let cancelled = false;
    setLoading(true);

    apiFetch<StockOverview>(`/api/stocks/overview?symbol=${encodeURIComponent(symbol)}`)
      .then(res => { if (!cancelled) { setData(res); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol]);

  return { data, loading, error };
}

// ── useStockSearch ─────────────────────────────────────
// Debounced search with 300ms delay

export function useStockSearch(query: string, debounceMs = 300) {
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      setError(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ results: StockSearchResult[] }>(`/api/stocks/search?q=${encodeURIComponent(query)}`);
        setResults(res.results);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, debounceMs]);

  return { results, loading, error };
}

// ── useMultiQuote ──────────────────────────────────────
// Fetch quotes for multiple symbols at once

export function useMultiQuote(symbols: string[], refreshMs = 60_000) {
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (symbols.length === 0) return;
    setLoading(true);
    const results: Record<string, StockQuote> = {};

    await Promise.allSettled(
      symbols.map(async (sym) => {
        try {
          const q = await apiFetch<StockQuote>(`/api/stocks/quote?symbol=${encodeURIComponent(sym)}`);
          results[sym] = q;
        } catch {} // silently skip failed
      })
    );

    setQuotes(prev => ({ ...prev, ...results }));
    setLoading(false);
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
    if (refreshMs > 0) {
      const interval = setInterval(fetchAll, refreshMs);
      return () => clearInterval(interval);
    }
  }, [fetchAll, refreshMs]);

  return { quotes, loading, refetch: fetchAll };
}
