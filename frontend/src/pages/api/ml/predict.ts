/**
 * POST /api/ml/predict
 * Public (rate-limited) ML prediction passthrough.
 * Does NOT expose raw model internals.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { mlClient } from '../../../lib/mlClient';
import {
    compose,
    withErrorHandler,
    withMethod,
    withRateLimit,
} from '../../../server/middleware';
import type { AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:ml:predict');

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    const {
        symbol, market, date, close, open, high, low, prev_close,
        adj_close, volume, vwap, turnover, trades, deliv_volume,
        pct_deliv, market_return_1d, market_up_ratio, source, series,
    } = req.body ?? {};

    // Basic input validation
    if (close !== undefined && (typeof close !== 'number' || !isFinite(close))) {
        return res.status(400).json({ error: 'Invalid close price' });
    }
    if (volume !== undefined && (typeof volume !== 'number' || volume < 0)) {
        return res.status(400).json({ error: 'Invalid volume' });
    }

    const result = await mlClient.predict({
        symbol, market, date, close, open, high, low, prev_close,
        adj_close, volume, vwap, turnover, trades, deliv_volume,
        pct_deliv, market_return_1d, market_up_ratio, source, series,
    });

    log.info(
        { symbol, prob: result.probability, signal: result.signal },
        'ml/predict called'
    );

    // Only expose safe fields — never raw internals
    return res.status(200).json({
        probability: result.probability,
        confidence: result.confidence,
        signal: result.signal,
        risk_flags: result.risk_flags,
        fair_price: result.fair_price,
        cached: result.cached,
        latency_ms: result.latency_ms,
    });
}

export default compose(
    withErrorHandler,
    withMethod('POST'),
    withRateLimit({ maxRequests: 30, windowMs: 60_000, keyPrefix: 'ml:predict' })
)(handler);
