/**
 * PumpX — ML Client (Singleton)
 *
 * Single point of contact for all model predictions.
 * Never call the Python service directly from other files.
 *
 * Usage:
 *   import { mlClient, PredictionResult } from '@/lib/mlClient';
 *   const result = await mlClient.predict({ symbol: 'AAPL', close: 180, volume: 5e7 });
 */

import { createLogger } from '../server/logger';

const log = createLogger('ml-client');

// ── Config ────────────────────────────────────────────────────────────────────

const ML_SERVICE_URL =
    (process.env.ML_SERVICE_URL ?? 'http://localhost:8001').replace(/\/$/, '');

const ML_BLEND_WEIGHT = Math.min(
    1,
    Math.max(0, parseFloat(process.env.ML_BLEND_WEIGHT ?? '0.4'))
);

const REQUEST_TIMEOUT_MS = 3000; // 3 s hard limit
const CACHE_TTL_MS = 60_000;     // 1 minute

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PredictionInput {
    symbol?: string;
    market?: string;
    date?: string;
    close?: number;
    open?: number;
    high?: number;
    low?: number;
    prev_close?: number;
    adj_close?: number;
    volume?: number;
    vwap?: number;
    turnover?: number;
    trades?: number;
    deliv_volume?: number;
    pct_deliv?: number;
    market_return_1d?: number;
    market_up_ratio?: number;
    source?: string;
    series?: string;
}

export interface PredictionResult {
    probability: number;        // [0.01, 0.99]
    confidence: number;         // [0, 1]
    raw_score: number;
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    risk_flags: string[];
    cached: boolean;
    latency_ms?: number;
    /** The blended price: ML_BLEND_WEIGHT * probability + (1-weight) * marketImplied */
    blended_probability?: number;
    fair_price?: number;        // probability * 100
}

export interface ModelHealth {
    status: 'ok' | 'degraded';
    model_loaded: boolean;
    model_type: string | null;
    feature_count: number;
    cache_size: number;
    drift: {
        psi: number | null;
        status: string | null;
        window_size: number;
        window_capacity: number;
    };
    timestamp: number;
}

export interface DriftStatus {
    psi: number | null;
    status: string | null;
    alert_threshold: number;
    danger_threshold: number;
    window_size: number;
    window_capacity: number;
    recent_window_mean: number | null;
    recent_window_std: number | null;
    is_degrading: boolean;
    ready: boolean;
}

// ── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_RESULT: PredictionResult = {
    probability: 0.5,
    confidence: 0.0,
    raw_score: 0.5,
    signal: 'NEUTRAL',
    risk_flags: ['MODEL_UNAVAILABLE'],
    cached: false,
    fair_price: 50,
};

// ── In-process cache ──────────────────────────────────────────────────────────

interface CacheEntry {
    result: PredictionResult;
    expiresAt: number;
}

function inputCacheKey(input: PredictionInput): string {
    // Exclude ephemeral date for cache stability
    const { date: _date, ...stable } = input;
    return JSON.stringify(stable, Object.keys(stable).sort());
}

// ── Fetch helper with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

class MLClient {
    private cache = new Map<string, CacheEntry>();

    /** Evict expired cache entries. */
    private evict() {
        const now = Date.now();
        for (const [k, v] of this.cache.entries()) {
            if (v.expiresAt < now) this.cache.delete(k);
        }
    }

    /** Clip and validate a probability value. */
    private sanitize(result: PredictionResult): PredictionResult {
        return {
            ...result,
            probability: Math.max(0.01, Math.min(0.99, result.probability)),
            confidence: Math.max(0, Math.min(1, result.confidence)),
            fair_price: Math.round(Math.max(0.01, Math.min(0.99, result.probability)) * 100),
        };
    }

    /**
     * Get a prediction for a single input.
     * Falls back to neutral 0.5 on any failure.
     */
    async predict(input: PredictionInput): Promise<PredictionResult> {
        this.evict();
        const key = inputCacheKey(input);

        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return { ...cached.result, cached: true };
        }

        try {
            const response = await fetchWithTimeout(
                `${ML_SERVICE_URL}/predict`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(input),
                },
                REQUEST_TIMEOUT_MS
            );

            if (!response.ok) {
                throw new Error(`ML service returned ${response.status}`);
            }

            const raw = await response.json();
            const result = this.sanitize(raw as PredictionResult);

            this.cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
            log.info(
                { symbol: input.symbol, prob: result.probability, signal: result.signal },
                'ML prediction'
            );
            return result;
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn({ err: msg, symbol: input.symbol }, 'ML prediction fallback to 0.5');
            return { ...FALLBACK_RESULT, risk_flags: [`MODEL_UNAVAILABLE: ${msg}`] };
        }
    }

    /**
     * Blend model probability with market-implied probability.
     * final = ML_BLEND_WEIGHT * modelProb + (1 - ML_BLEND_WEIGHT) * marketImplied
     */
    blend(modelProbability: number, marketImpliedProbability: number): number {
        const blended = ML_BLEND_WEIGHT * modelProbability + (1 - ML_BLEND_WEIGHT) * marketImpliedProbability;
        return Math.max(0.01, Math.min(0.99, blended));
    }

    /** Get prediction with optional blended price (for AMM anchoring). */
    async predictWithBlend(
        input: PredictionInput,
        marketImpliedProbability?: number
    ): Promise<PredictionResult> {
        const result = await this.predict(input);
        if (marketImpliedProbability !== undefined) {
            const blended = this.blend(result.probability, marketImpliedProbability);
            return {
                ...result,
                blended_probability: blended,
                fair_price: Math.round(blended * 100),
            };
        }
        return result;
    }

    /** Batch predictions — up to 100 items. */
    async predictBatch(
        items: PredictionInput[]
    ): Promise<PredictionResult[]> {
        try {
            const response = await fetchWithTimeout(
                `${ML_SERVICE_URL}/predict/batch`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items }),
                },
                Math.min(REQUEST_TIMEOUT_MS * items.length, 15_000)
            );

            if (!response.ok) throw new Error(`ML batch returned ${response.status}`);
            const { results } = await response.json();
            return (results as PredictionResult[]).map((r) => this.sanitize(r));
        } catch {
            // Return fallback for every item
            return items.map(() => ({ ...FALLBACK_RESULT }));
        }
    }

    /** Fetch model health from the microservice. */
    async getHealth(): Promise<ModelHealth | null> {
        try {
            const res = await fetchWithTimeout(
                `${ML_SERVICE_URL}/health`,
                { method: 'GET' },
                REQUEST_TIMEOUT_MS
            );
            if (!res.ok) return null;
            return res.json();
        } catch {
            return null;
        }
    }

    /** Fetch drift status from the microservice. */
    async getDriftStatus(): Promise<DriftStatus | null> {
        try {
            const res = await fetchWithTimeout(
                `${ML_SERVICE_URL}/drift`,
                { method: 'GET' },
                REQUEST_TIMEOUT_MS
            );
            if (!res.ok) return null;
            return res.json();
        } catch {
            return null;
        }
    }

    /** Current blend weight (from env). */
    get blendWeight(): number {
        return ML_BLEND_WEIGHT;
    }

    /** ML service base URL. */
    get serviceUrl(): string {
        return ML_SERVICE_URL;
    }
}

// Export singleton
export const mlClient = new MLClient();
