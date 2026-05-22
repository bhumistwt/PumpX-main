/**
 * PumpX — Stock Market Data Abstraction Layer
 * 
 * Multi-provider architecture:
 *   Primary:   Alpha Vantage  (free tier: 25 req/day, 5 req/min)
 *   Fallback:  Twelve Data    (free tier: 800 req/day, 8 req/min)
 * 
 * Features:
 *   - In-memory cache with TTL
 *   - Rate limit tracking per provider
 *   - Automatic fallback on failure
 *   - Typed responses
 */

// ── Types ──────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: number;
  provider: 'alphavantage' | 'twelvedata' | 'cache';
}

export interface StockHistoryPoint {
  date: string;       // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockOverview {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  eps: number;
  dividendYield: number;
  weekHigh52: number;
  weekLow52: number;
  avgVolume: number;
  description: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
}

// ── Cache ──────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number) {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  clear() { this.store.clear(); }
}

// ── Rate Limiter ───────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];
  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  canRequest(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length < this.maxRequests;
  }

  record() {
    this.timestamps.push(Date.now());
  }

  get remaining(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - this.timestamps.length);
  }
}

// ── Alpha Vantage Provider ─────────────────────────────

class AlphaVantageProvider {
  private rateLimiter = new RateLimiter(5, 60_000); // 5 req/min

  constructor(private apiKey: string) {}

  get canRequest() { return this.rateLimiter.canRequest(); }

  async getQuote(symbol: string): Promise<StockQuote> {
    if (!this.rateLimiter.canRequest()) throw new Error('AV rate limit reached');
    this.rateLimiter.record();

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
    const json = await res.json();

    if (json['Note'] || json['Information']) throw new Error('AV rate limit: ' + (json['Note'] || json['Information']));

    const gq = json['Global Quote'];
    if (!gq || !gq['05. price']) throw new Error('AV: no quote data');

    return {
      symbol: gq['01. symbol'],
      price: parseFloat(gq['05. price']),
      change: parseFloat(gq['09. change']),
      changePercent: parseFloat(gq['10. change percent']?.replace('%', '') || '0'),
      high: parseFloat(gq['03. high']),
      low: parseFloat(gq['04. low']),
      open: parseFloat(gq['02. open']),
      previousClose: parseFloat(gq['08. previous close']),
      volume: parseInt(gq['06. volume'], 10),
      timestamp: Date.now(),
      provider: 'alphavantage',
    };
  }

  async getHistory(symbol: string, outputsize: 'compact' | 'full' = 'compact'): Promise<StockHistoryPoint[]> {
    if (!this.rateLimiter.canRequest()) throw new Error('AV rate limit reached');
    this.rateLimiter.record();

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputsize}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
    const json = await res.json();

    if (json['Note'] || json['Information']) throw new Error('AV rate limit');

    const ts = json['Time Series (Daily)'];
    if (!ts) throw new Error('AV: no history data');

    return Object.entries(ts).map(([date, vals]: [string, any]) => ({
      date,
      open: parseFloat(vals['1. open']),
      high: parseFloat(vals['2. high']),
      low: parseFloat(vals['3. low']),
      close: parseFloat(vals['4. close']),
      volume: parseInt(vals['5. volume'], 10),
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getOverview(symbol: string): Promise<StockOverview> {
    if (!this.rateLimiter.canRequest()) throw new Error('AV rate limit reached');
    this.rateLimiter.record();

    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
    const json = await res.json();

    if (json['Note'] || json['Information']) throw new Error('AV rate limit');
    if (!json['Symbol']) throw new Error('AV: no overview data');

    return {
      symbol: json['Symbol'],
      name: json['Name'] || '',
      exchange: json['Exchange'] || '',
      sector: json['Sector'] || '',
      industry: json['Industry'] || '',
      marketCap: parseFloat(json['MarketCapitalization'] || '0'),
      peRatio: parseFloat(json['PERatio'] || '0'),
      eps: parseFloat(json['EPS'] || '0'),
      dividendYield: parseFloat(json['DividendYield'] || '0'),
      weekHigh52: parseFloat(json['52WeekHigh'] || '0'),
      weekLow52: parseFloat(json['52WeekLow'] || '0'),
      avgVolume: parseInt(json['200DayMovingAverage'] || '0', 10),
      description: json['Description'] || '',
    };
  }

  async search(query: string): Promise<StockSearchResult[]> {
    if (!this.rateLimiter.canRequest()) throw new Error('AV rate limit reached');
    this.rateLimiter.record();

    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`AV HTTP ${res.status}`);
    const json = await res.json();

    const matches = json['bestMatches'] || [];
    return matches.map((m: any) => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
      type: m['3. type'],
      region: m['4. region'],
      currency: m['8. currency'],
    }));
  }
}

// ── Twelve Data Provider (Fallback) ────────────────────

class TwelveDataProvider {
  private rateLimiter = new RateLimiter(8, 60_000); // 8 req/min

  constructor(private apiKey: string) {}

  get canRequest() { return this.rateLimiter.canRequest(); }

  async getQuote(symbol: string): Promise<StockQuote> {
    if (!this.rateLimiter.canRequest()) throw new Error('TD rate limit reached');
    this.rateLimiter.record();

    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TD HTTP ${res.status}`);
    const json = await res.json();

    if (json.code && json.code !== 200) throw new Error(`TD error: ${json.message}`);

    return {
      symbol: json.symbol,
      price: parseFloat(json.close),
      change: parseFloat(json.change),
      changePercent: parseFloat(json.percent_change),
      high: parseFloat(json.high),
      low: parseFloat(json.low),
      open: parseFloat(json.open),
      previousClose: parseFloat(json.previous_close),
      volume: parseInt(json.volume, 10),
      timestamp: Date.now(),
      provider: 'twelvedata',
    };
  }

  async getHistory(symbol: string, days = 100): Promise<StockHistoryPoint[]> {
    if (!this.rateLimiter.canRequest()) throw new Error('TD rate limit reached');
    this.rateLimiter.record();

    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${days}&apikey=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TD HTTP ${res.status}`);
    const json = await res.json();

    if (json.code && json.code !== 200) throw new Error(`TD error: ${json.message}`);

    const values = json.values || [];
    return values.map((v: any) => ({
      date: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume, 10),
    })).reverse(); // TD returns newest-first
  }
}

// ── Main Client ────────────────────────────────────────

export class StockDataClient {
  private cache = new TTLCache();
  private av: AlphaVantageProvider | null;
  private td: TwelveDataProvider | null;

  private static QUOTE_TTL = 60_000;        // 1 min
  private static HISTORY_TTL = 300_000;      // 5 min
  private static OVERVIEW_TTL = 3_600_000;   // 1 hr
  private static SEARCH_TTL = 600_000;       // 10 min

  constructor(avKey?: string, tdKey?: string) {
    this.av = avKey ? new AlphaVantageProvider(avKey) : null;
    this.td = tdKey ? new TwelveDataProvider(tdKey) : null;
  }

  get hasProvider(): boolean {
    return !!(this.av || this.td);
  }

  // ── Quote ──────────────────────────────────────────

  async getQuote(symbol: string): Promise<StockQuote> {
    const key = `quote:${symbol.toUpperCase()}`;
    const cached = this.cache.get<StockQuote>(key);
    if (cached) return { ...cached, provider: 'cache' };

    let lastError: Error | null = null;

    // Try Alpha Vantage first
    if (this.av?.canRequest) {
      try {
        const data = await this.av.getQuote(symbol);
        this.cache.set(key, data, StockDataClient.QUOTE_TTL);
        return data;
      } catch (e) { lastError = e as Error; }
    }

    // Fallback to Twelve Data
    if (this.td?.canRequest) {
      try {
        const data = await this.td.getQuote(symbol);
        this.cache.set(key, data, StockDataClient.QUOTE_TTL);
        return data;
      } catch (e) { lastError = e as Error; }
    }

    throw lastError || new Error('No stock data provider available');
  }

  // ── History ────────────────────────────────────────

  async getHistory(symbol: string, days = 100): Promise<StockHistoryPoint[]> {
    const key = `history:${symbol.toUpperCase()}:${days}`;
    const cached = this.cache.get<StockHistoryPoint[]>(key);
    if (cached) return cached;

    let lastError: Error | null = null;

    if (this.av?.canRequest) {
      try {
        const data = await this.av.getHistory(symbol, days > 100 ? 'full' : 'compact');
        const sliced = data.slice(-days);
        this.cache.set(key, sliced, StockDataClient.HISTORY_TTL);
        return sliced;
      } catch (e) { lastError = e as Error; }
    }

    if (this.td?.canRequest) {
      try {
        const data = await this.td.getHistory(symbol, days);
        this.cache.set(key, data, StockDataClient.HISTORY_TTL);
        return data;
      } catch (e) { lastError = e as Error; }
    }

    throw lastError || new Error('No stock data provider available');
  }

  // ── Overview / Fundamentals ────────────────────────

  async getOverview(symbol: string): Promise<StockOverview> {
    const key = `overview:${symbol.toUpperCase()}`;
    const cached = this.cache.get<StockOverview>(key);
    if (cached) return cached;

    if (!this.av) throw new Error('Overview requires Alpha Vantage');

    const data = await this.av.getOverview(symbol);
    this.cache.set(key, data, StockDataClient.OVERVIEW_TTL);
    return data;
  }

  // ── Search ─────────────────────────────────────────

  async search(query: string): Promise<StockSearchResult[]> {
    const key = `search:${query.toLowerCase()}`;
    const cached = this.cache.get<StockSearchResult[]>(key);
    if (cached) return cached;

    if (!this.av) throw new Error('Search requires Alpha Vantage');

    const data = await this.av.search(query);
    this.cache.set(key, data, StockDataClient.SEARCH_TTL);
    return data;
  }

  // ── Utility ────────────────────────────────────────

  clearCache() { this.cache.clear(); }
}

// ── Singleton for server-side use ──────────────────────

let _instance: StockDataClient | null = null;

export function getStockClient(): StockDataClient {
  if (!_instance) {
    _instance = new StockDataClient(
      process.env.ALPHA_VANTAGE_API_KEY,
      process.env.TWELVE_DATA_API_KEY,
    );
  }
  return _instance;
}
