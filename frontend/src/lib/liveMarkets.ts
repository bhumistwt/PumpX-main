/**
 * PumpX — Live Worldwide Markets Data Layer
 *
 * Free APIs (no API key required):
 *   - CoinGecko     → Top crypto coins, global data, trending
 *   - Frankfurter   → ECB forex exchange rates
 *   - Server cache   → In-memory TTL cache to respect rate limits
 *
 * Falls back to existing Alpha Vantage / Twelve Data for equities
 * when API keys are configured.
 */

// ── Types ──────────────────────────────────────────────

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  sparkline_in_7d?: { price: number[] };
  ath: number;
  ath_change_percentage: number;
  last_updated: string;
}

export interface ForexRate {
  pair: string;
  base: string;
  quote: string;
  rate: number;
  change: number;        // vs previous close (calculated)
  changePercent: number;
}

export interface GlobalMarketData {
  total_market_cap_usd: number;
  total_volume_24h_usd: number;
  market_cap_change_24h_pct: number;
  btc_dominance: number;
  eth_dominance: number;
  active_cryptocurrencies: number;
  markets: number;
}

export interface IndexData {
  symbol: string;
  name: string;
  region: string;
  price: number;
  change: number;
  changePercent: number;
  flag: string;
}

export interface CommodityData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number;
  price_btc: number;
  score: number;
}

export interface LiveMarketsSnapshot {
  crypto: CryptoAsset[];
  forex: ForexRate[];
  global: GlobalMarketData | null;
  indices: IndexData[];
  commodities: CommodityData[];
  trending: TrendingCoin[];
  timestamp: number;
}

// ── Cache ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCache<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiry) { cache.delete(key); return null; }
  return e.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

// ── CoinGecko — Crypto ─────────────────────────────────

const CG_BASE = 'https://api.coingecko.com/api/v3';

export async function fetchTopCrypto(count = 50, page = 1): Promise<CryptoAsset[]> {
  const key = `cg:top:${count}:${page}`;
  const cached = getCache<CryptoAsset[]>(key);
  if (cached) return cached;

  const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${count}&page=${page}&sparkline=true&price_change_percentage=7d`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data: CryptoAsset[] = await res.json();

  setCache(key, data, 60_000); // 1 min
  return data;
}

export async function fetchGlobalCrypto(): Promise<GlobalMarketData> {
  const key = 'cg:global';
  const cached = getCache<GlobalMarketData>(key);
  if (cached) return cached;

  const url = `${CG_BASE}/global`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json();
  const d = json.data;

  const data: GlobalMarketData = {
    total_market_cap_usd: d.total_market_cap?.usd ?? 0,
    total_volume_24h_usd: d.total_volume?.usd ?? 0,
    market_cap_change_24h_pct: d.market_cap_change_percentage_24h_usd ?? 0,
    btc_dominance: d.market_cap_percentage?.btc ?? 0,
    eth_dominance: d.market_cap_percentage?.eth ?? 0,
    active_cryptocurrencies: d.active_cryptocurrencies ?? 0,
    markets: d.markets ?? 0,
  };

  setCache(key, data, 120_000); // 2 min
  return data;
}

export async function fetchTrending(): Promise<TrendingCoin[]> {
  const key = 'cg:trending';
  const cached = getCache<TrendingCoin[]>(key);
  if (cached) return cached;

  const url = `${CG_BASE}/search/trending`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json();

  const data: TrendingCoin[] = (json.coins || []).map((c: any) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    thumb: c.item.thumb,
    market_cap_rank: c.item.market_cap_rank,
    price_btc: c.item.price_btc,
    score: c.item.score,
  }));

  setCache(key, data, 300_000); // 5 min
  return data;
}

// ── CoinPaprika — Fallback Crypto Provider ─────────────

const CP_BASE = 'https://api.coinpaprika.com/v1';

export async function fetchTopCryptoPaprika(count = 50): Promise<CryptoAsset[]> {
  const key = `cp:top:${count}`;
  const cached = getCache<CryptoAsset[]>(key);
  if (cached) return cached;

  const url = `${CP_BASE}/tickers?limit=${count}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinPaprika HTTP ${res.status}`);
  const tickers: any[] = await res.json();

  const data: CryptoAsset[] = tickers.map((t: any) => {
    const q = t.quotes?.USD ?? {};
    return {
      id: t.id,
      symbol: (t.symbol ?? '').toLowerCase(),
      name: t.name,
      image: `https://static.coinpaprika.com/coin/${t.id}/logo.png`,
      current_price: q.price ?? 0,
      price_change_percentage_24h: q.percent_change_24h ?? 0,
      price_change_percentage_7d_in_currency: q.percent_change_7d ?? 0,
      market_cap: q.market_cap ?? 0,
      market_cap_rank: t.rank ?? 0,
      total_volume: q.volume_24h ?? 0,
      high_24h: 0,
      low_24h: 0,
      circulating_supply: t.total_supply ?? 0,
      total_supply: t.max_supply ?? null,
      sparkline_in_7d: undefined,
      ath: q.ath_price ?? 0,
      ath_change_percentage: q.percent_from_price_ath ?? 0,
      last_updated: t.last_updated ?? new Date().toISOString(),
    };
  });

  setCache(key, data, 60_000); // 1 min
  return data;
}

export async function fetchGlobalCryptoPaprika(): Promise<GlobalMarketData> {
  const key = 'cp:global';
  const cached = getCache<GlobalMarketData>(key);
  if (cached) return cached;

  const url = `${CP_BASE}/global`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinPaprika HTTP ${res.status}`);
  const d: any = await res.json();

  const data: GlobalMarketData = {
    total_market_cap_usd: d.market_cap_usd ?? 0,
    total_volume_24h_usd: d.volume_24h_usd ?? 0,
    market_cap_change_24h_pct: d.market_cap_change_24h ?? 0,
    btc_dominance: d.bitcoin_dominance_percentage ?? 0,
    eth_dominance: 0, // CoinPaprika global doesn't provide ETH dominance
    active_cryptocurrencies: d.cryptocurrencies_number ?? 0,
    markets: 0,
  };

  setCache(key, data, 120_000); // 2 min
  return data;
}

export async function fetchTrendingPaprika(): Promise<TrendingCoin[]> {
  const key = 'cp:trending';
  const cached = getCache<TrendingCoin[]>(key);
  if (cached) return cached;

  // CoinPaprika doesn't have a trending endpoint; derive from top tickers sorted by 24h volume change
  const url = `${CP_BASE}/tickers?limit=100`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CoinPaprika HTTP ${res.status}`);
  const tickers: any[] = await res.json();

  // Pick the coins with the highest 24h volume change as "trending"
  const sorted = [...tickers]
    .filter((t: any) => (t.quotes?.USD?.volume_24h_change_24h ?? 0) > 0)
    .sort((a: any, b: any) =>
      (b.quotes?.USD?.volume_24h_change_24h ?? 0) - (a.quotes?.USD?.volume_24h_change_24h ?? 0)
    )
    .slice(0, 10);

  const data: TrendingCoin[] = sorted.map((t: any, i: number) => ({
    id: t.id,
    name: t.name,
    symbol: (t.symbol ?? '').toLowerCase(),
    thumb: `https://static.coinpaprika.com/coin/${t.id}/logo.png`,
    market_cap_rank: t.rank ?? 0,
    price_btc: 0,
    score: i,
  }));

  setCache(key, data, 300_000); // 5 min
  return data;
}

// ── Frankfurter — Forex ────────────────────────────────

const FOREX_PAIRS = [
  { base: 'USD', quote: 'EUR' },
  { base: 'USD', quote: 'GBP' },
  { base: 'USD', quote: 'JPY' },
  { base: 'USD', quote: 'CHF' },
  { base: 'USD', quote: 'AUD' },
  { base: 'USD', quote: 'CAD' },
  { base: 'USD', quote: 'CNY' },
  { base: 'USD', quote: 'INR' },
  { base: 'USD', quote: 'SGD' },
  { base: 'USD', quote: 'HKD' },
  { base: 'EUR', quote: 'GBP' },
  { base: 'EUR', quote: 'JPY' },
];

export async function fetchForexRates(): Promise<ForexRate[]> {
  const key = 'forex:rates';
  const cached = getCache<ForexRate[]>(key);
  if (cached) return cached;

  try {
    // Get latest and previous day rates from Frankfurter (ECB data)
    const symbols = [...new Set(FOREX_PAIRS.flatMap(p => [p.base, p.quote]))].filter(s => s !== 'EUR');
    const symbolParam = symbols.join(',');

    const [latestRes, prevRes] = await Promise.all([
      fetch(`https://api.frankfurter.app/latest?from=EUR&to=${symbolParam}`),
      fetch(`https://api.frankfurter.app/${getPreviousBusinessDay()}?from=EUR&to=${symbolParam}`),
    ]);

    if (!latestRes.ok || !prevRes.ok) throw new Error('Frankfurter API error');

    const latest = await latestRes.json();
    const prev = await prevRes.json();

    const rates: ForexRate[] = FOREX_PAIRS.map(({ base, quote }) => {
      // Convert through EUR base
      const latestBase = base === 'EUR' ? 1 : (latest.rates[base] || 1);
      const latestQuote = quote === 'EUR' ? 1 : (latest.rates[quote] || 1);
      const prevBase = base === 'EUR' ? 1 : (prev.rates[base] || 1);
      const prevQuote = quote === 'EUR' ? 1 : (prev.rates[quote] || 1);

      const rate = latestQuote / latestBase;
      const prevRate = prevQuote / prevBase;
      const change = rate - prevRate;
      const changePercent = prevRate !== 0 ? (change / prevRate) * 100 : 0;

      return {
        pair: `${base}/${quote}`,
        base,
        quote,
        rate: parseFloat(rate.toFixed(4)),
        change: parseFloat(change.toFixed(4)),
        changePercent: parseFloat(changePercent.toFixed(2)),
      };
    });

    setCache(key, rates, 300_000); // 5 min
    return rates;
  } catch (e) {
    console.error('Forex fetch error:', e);
    return [];
  }
}

function getPreviousBusinessDay(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

// ── Global Indices (curated from CoinGecko + static metadata) ──

export function getGlobalIndices(): IndexData[] {
  // These are curated world indices with approximate real-time feel
  // In production, these would come from Alpha Vantage / Twelve Data with API keys
  return [
    { symbol: '^GSPC', name: 'S&P 500', region: 'US', price: 0, change: 0, changePercent: 0, flag: '🇺🇸' },
    { symbol: '^DJI', name: 'Dow Jones', region: 'US', price: 0, change: 0, changePercent: 0, flag: '🇺🇸' },
    { symbol: '^IXIC', name: 'NASDAQ', region: 'US', price: 0, change: 0, changePercent: 0, flag: '🇺🇸' },
    { symbol: '^FTSE', name: 'FTSE 100', region: 'UK', price: 0, change: 0, changePercent: 0, flag: '🇬🇧' },
    { symbol: '^N225', name: 'Nikkei 225', region: 'Japan', price: 0, change: 0, changePercent: 0, flag: '🇯🇵' },
    { symbol: '^HSI', name: 'Hang Seng', region: 'Hong Kong', price: 0, change: 0, changePercent: 0, flag: '🇭🇰' },
    { symbol: '^GDAXI', name: 'DAX', region: 'Germany', price: 0, change: 0, changePercent: 0, flag: '🇩🇪' },
    { symbol: '^FCHI', name: 'CAC 40', region: 'France', price: 0, change: 0, changePercent: 0, flag: '🇫🇷' },
    { symbol: '^AXJO', name: 'ASX 200', region: 'Australia', price: 0, change: 0, changePercent: 0, flag: '🇦🇺' },
    { symbol: '^BSESN', name: 'BSE Sensex', region: 'India', price: 0, change: 0, changePercent: 0, flag: '🇮🇳' },
    { symbol: '000001.SS', name: 'SSE Composite', region: 'China', price: 0, change: 0, changePercent: 0, flag: '🇨🇳' },
    { symbol: '^KS11', name: 'KOSPI', region: 'South Korea', price: 0, change: 0, changePercent: 0, flag: '🇰🇷' },
  ];
}

// ── Commodities (curated, enriched from stock API when available) ──

export function getCommodities(): CommodityData[] {
  return [
    { symbol: 'GC=F', name: 'Gold', price: 0, change: 0, changePercent: 0, unit: 'oz' },
    { symbol: 'SI=F', name: 'Silver', price: 0, change: 0, changePercent: 0, unit: 'oz' },
    { symbol: 'CL=F', name: 'Crude Oil (WTI)', price: 0, change: 0, changePercent: 0, unit: 'bbl' },
    { symbol: 'BZ=F', name: 'Brent Crude', price: 0, change: 0, changePercent: 0, unit: 'bbl' },
    { symbol: 'NG=F', name: 'Natural Gas', price: 0, change: 0, changePercent: 0, unit: 'MMBtu' },
    { symbol: 'PL=F', name: 'Platinum', price: 0, change: 0, changePercent: 0, unit: 'oz' },
  ];
}

// ── Enrichment — try to fill indices/commodities with stock API data ──

// ── Symbol mapping: Yahoo-style → Alpha Vantage ETF proxies ──

const AV_SYMBOL_MAP: Record<string, string> = {
  // Indices → tracking ETFs
  '^GSPC':    'SPY',   // S&P 500
  '^DJI':     'DIA',   // Dow Jones
  '^IXIC':    'QQQ',   // NASDAQ 100
  '^FTSE':    'EWU',   // UK (FTSE proxy)
  '^N225':    'EWJ',   // Japan (Nikkei proxy)
  '^HSI':     'EWH',   // Hong Kong
  '^GDAXI':  'EWG',   // Germany (DAX proxy)
  '^FCHI':    'EWQ',   // France (CAC proxy)
  '^AXJO':    'EWA',   // Australia (ASX proxy)
  '^BSESN':  'INDA',  // India (Sensex proxy)
  '000001.SS':'FXI',   // China (SSE proxy)
  '^KS11':    'EWY',   // South Korea (KOSPI proxy)
  // Commodities → tracking ETFs
  'GC=F':     'GLD',   // Gold
  'SI=F':     'SLV',   // Silver
  'CL=F':     'USO',   // Crude Oil WTI
  'BZ=F':     'BNO',   // Brent Crude
  'NG=F':     'UNG',   // Natural Gas
  'PL=F':     'PPLT',  // Platinum
};

export async function enrichWithStockAPI(
  indices: IndexData[],
  commodities: CommodityData[],
  avKey?: string,
  tdKey?: string
): Promise<{ indices: IndexData[]; commodities: CommodityData[] }> {
  if (!avKey && !tdKey) return { indices, commodities };

  const { StockDataClient } = await import('./stockData');
  const client = new StockDataClient(avKey, tdKey);

  if (!client.hasProvider) return { indices, commodities };

  // Interleave indices & commodities so both categories get data within rate limits
  type TaggedItem = { type: 'index'; item: IndexData } | { type: 'commodity'; item: CommodityData };
  const interleaved: TaggedItem[] = [];
  const maxLen = Math.max(indices.length, commodities.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < indices.length) interleaved.push({ type: 'index', item: indices[i] });
    if (i < commodities.length) interleaved.push({ type: 'commodity', item: commodities[i] });
  }

  const enrichedIndicesMap = new Map<string, IndexData>();
  const enrichedCommoditiesMap = new Map<string, CommodityData>();

  for (const tagged of interleaved) {
    const symbol = tagged.item.symbol;
    const mappedSymbol = AV_SYMBOL_MAP[symbol] || symbol;
    try {
      const q = await client.getQuote(mappedSymbol);
      if (tagged.type === 'index') {
        enrichedIndicesMap.set(symbol, { ...tagged.item, price: q.price, change: q.change, changePercent: q.changePercent });
      } else {
        enrichedCommoditiesMap.set(symbol, { ...tagged.item, price: q.price, change: q.change, changePercent: q.changePercent });
      }
    } catch {
      // Keep original data if rate-limited or error
    }
  }

  return {
    indices: indices.map(idx => enrichedIndicesMap.get(idx.symbol) || idx),
    commodities: commodities.map(c => enrichedCommoditiesMap.get(c.symbol) || c),
  };
}

// ── Full Snapshot ──────────────────────────────────────

async function fetchCryptoWithFallback(count = 50): Promise<CryptoAsset[]> {
  try {
    const data = await fetchTopCrypto(count);
    if (data.length > 0) return data;
  } catch (e) {
    console.warn('[LiveMarkets] CoinGecko crypto failed, trying CoinPaprika:', (e as Error).message);
  }
  return fetchTopCryptoPaprika(count);
}

async function fetchGlobalWithFallback(): Promise<GlobalMarketData | null> {
  try {
    return await fetchGlobalCrypto();
  } catch (e) {
    console.warn('[LiveMarkets] CoinGecko global failed, trying CoinPaprika:', (e as Error).message);
  }
  return fetchGlobalCryptoPaprika();
}

async function fetchTrendingWithFallback(): Promise<TrendingCoin[]> {
  try {
    const data = await fetchTrending();
    if (data.length > 0) return data;
  } catch (e) {
    console.warn('[LiveMarkets] CoinGecko trending failed, trying CoinPaprika:', (e as Error).message);
  }
  return fetchTrendingPaprika();
}

export async function fetchLiveMarketsSnapshot(): Promise<LiveMarketsSnapshot> {
  const [crypto, global, forex, trending] = await Promise.all([
    fetchCryptoWithFallback(50).catch(() => [] as CryptoAsset[]),
    fetchGlobalWithFallback().catch(() => null),
    fetchForexRates().catch(() => [] as ForexRate[]),
    fetchTrendingWithFallback().catch(() => [] as TrendingCoin[]),
  ]);

  let indices = getGlobalIndices();
  let commodities = getCommodities();

  // Enrich indices/commodities with real data if API keys configured
  try {
    const avKey = process.env.ALPHA_VANTAGE_API_KEY;
    const tdKey = process.env.TWELVE_DATA_API_KEY;
    const enriched = await enrichWithStockAPI(
      indices,
      commodities,
      avKey,
      tdKey,
    );
    indices = enriched.indices;
    commodities = enriched.commodities;
  } catch (e) {
    console.error('[LiveMarkets] Enrichment error:', e);
  }

  return {
    crypto,
    forex,
    global,
    indices,
    commodities,
    trending,
    timestamp: Date.now(),
  };
}
