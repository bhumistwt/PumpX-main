/**
 * PumpX — useMLPrediction Hook
 *
 * React hook that fetches ML prediction data for a market symbol.
 * Exposes: probability, confidence, signal, risk_flags, fair_price.
 * Does NOT expose raw model internals (raw_score).
 *
 * Usage:
 *   const { prediction, loading, error, refresh } = useMLPrediction('AAPL');
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface MLPrediction {
    probability: number;       // [0.01, 0.99]
    confidence: number;        // [0, 1]
    signal: 'BUY' | 'SELL' | 'NEUTRAL';
    risk_flags: string[];
    fair_price: number;        // probability * 100
    cached: boolean;
    latency_ms?: number;
}

interface UseMLPredictionOptions {
    /** Auto-refresh interval in ms (default: 300_000 = 5 min). Set to 0 to disable. */
    refreshInterval?: number;
    /** Additional input fields (close, volume, etc.) */
    extraInputs?: Record<string, unknown>;
    /** Whether to fetch immediately on mount (default: true) */
    enabled?: boolean;
}

const FALLBACK: MLPrediction = {
    probability: 0.5,
    confidence: 0,
    signal: 'NEUTRAL',
    risk_flags: ['MODEL_UNAVAILABLE'],
    fair_price: 50,
    cached: false,
};

export function useMLPrediction(
    symbol: string | undefined,
    options: UseMLPredictionOptions = {}
) {
    const {
        refreshInterval = 300_000,
        extraInputs = {},
        enabled = true,
    } = options;

    const [prediction, setPrediction] = useState<MLPrediction>(FALLBACK);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchPrediction = useCallback(async () => {
        if (!symbol || !enabled) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/ml/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, ...extraInputs }),
            });

            if (!res.ok) {
                throw new Error(`ML API returned ${res.status}`);
            }

            const data = await res.json();

            // Only expose safe fields
            setPrediction({
                probability: data.probability ?? 0.5,
                confidence: data.confidence ?? 0,
                signal: data.signal ?? 'NEUTRAL',
                risk_flags: data.risk_flags ?? [],
                fair_price: data.fair_price ?? Math.round((data.probability ?? 0.5) * 100),
                cached: data.cached ?? false,
                latency_ms: data.latency_ms,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            setPrediction(FALLBACK);
        } finally {
            setLoading(false);
        }
    }, [symbol, enabled, JSON.stringify(extraInputs)]);

    // Initial fetch + auto-refresh
    useEffect(() => {
        if (!symbol || !enabled) return;

        fetchPrediction();

        if (refreshInterval > 0) {
            intervalRef.current = setInterval(fetchPrediction, refreshInterval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [fetchPrediction, refreshInterval, symbol, enabled]);

    return { prediction, loading, error, refresh: fetchPrediction };
}
