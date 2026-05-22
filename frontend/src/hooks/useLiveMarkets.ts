/**
 * PumpX — useLiveMarkets Hook
 *
 * Fetches real-time worldwide market data from /api/live-markets
 * Auto-refreshes every 30 seconds.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CryptoAsset,
  ForexRate,
  GlobalMarketData,
  IndexData,
  CommodityData,
  TrendingCoin,
  LiveMarketsSnapshot,
} from '../lib/liveMarkets';

export interface LiveMarketsState {
  crypto: CryptoAsset[];
  forex: ForexRate[];
  global: GlobalMarketData | null;
  indices: IndexData[];
  commodities: CommodityData[];
  trending: TrendingCoin[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refetch: () => Promise<void>;
}

export function useLiveMarkets(refreshMs = 30_000): LiveMarketsState {
  const [crypto, setCrypto] = useState<CryptoAsset[]>([]);
  const [forex, setForex] = useState<ForexRate[]>([]);
  const [global, setGlobal] = useState<GlobalMarketData | null>(null);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [commodities, setCommodities] = useState<CommodityData[]>([]);
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/live-markets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveMarketsSnapshot = await res.json();

      setCrypto(data.crypto);
      setForex(data.forex);
      setGlobal(data.global);
      setIndices(data.indices);
      setCommodities(data.commodities);
      setTrending(data.trending);
      setLastUpdated(data.timestamp);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch live markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (refreshMs > 0) {
      intervalRef.current = setInterval(fetchData, refreshMs);
      return () => clearInterval(intervalRef.current);
    }
  }, [fetchData, refreshMs]);

  return {
    crypto,
    forex,
    global,
    indices,
    commodities,
    trending,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
  };
}
