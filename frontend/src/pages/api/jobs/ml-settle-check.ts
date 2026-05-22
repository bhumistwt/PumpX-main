/**
 * POST /api/jobs/ml-settle-check
 * Settlement validation: re-run model and compare with historical trend.
 * Flags SETTLEMENT_ANOMALY if final probability spikes abnormally.
 * Protected by JOB_SECRET env var.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { mlClient } from '../../../lib/mlClient';
import { createLogger } from '../../../server/logger';

const log = createLogger('jobs:ml-settle-check');

const ANOMALY_THRESHOLD = parseFloat(
    process.env.SETTLE_ANOMALY_THRESHOLD ?? '0.30'
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = req.headers['x-job-secret'] ?? req.body?.secret;
    if (!process.env.JOB_SECRET || secret !== process.env.JOB_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Optional: check specific market or all markets nearing deadline
    const { marketAddress } = req.body ?? {};

    const where = marketAddress
        ? { contractAddress: (marketAddress as string).toLowerCase() }
        : {
            resolved: false,
            deadline: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // settling within 24h
        };

    const markets = await prisma.market.findMany({
        where,
        select: {
            contractAddress: true,
            question: true,
            stockTicker: true,
            modelBaselineProbability: true,
        },
    });

    const results = [];
    for (const market of markets) {
        try {
            // Current model probability
            const current = await mlClient.predict({
                symbol: market.stockTicker ?? 'UNKNOWN',
                market: 'US',
            });

            // 7-day average from prediction log
            const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const history = await prisma.modelPredictionLog.findMany({
                where: { marketAddress: market.contractAddress, createdAt: { gte: since7d } },
                select: { probability: true },
            });

            const historicalAvg =
                history.length > 0
                    ? history.reduce((s, h) => s + h.probability, 0) / history.length
                    : market.modelBaselineProbability ?? 0.5;

            const drift = Math.abs(current.probability - historicalAvg);
            const isAnomaly = drift > ANOMALY_THRESHOLD;

            const flags = [...current.risk_flags];
            if (isAnomaly) {
                flags.push(
                    `SETTLEMENT_ANOMALY: current=${current.probability.toFixed(3)} hist_avg=${historicalAvg.toFixed(3)} drift=${drift.toFixed(3)}`
                );
                log.warn({ market: market.contractAddress, drift }, 'SETTLEMENT_ANOMALY detected');
            }

            // Log to prediction log
            await prisma.modelPredictionLog.create({
                data: {
                    marketAddress: market.contractAddress,
                    probability: current.probability,
                    confidence: current.confidence,
                    signal: current.signal,
                    riskFlags: flags,
                    triggeredBy: 'SETTLEMENT',
                    rawScore: current.raw_score,
                },
            });

            results.push({
                market: market.contractAddress,
                question: market.question,
                currentProbability: current.probability,
                historicalAvg,
                drift,
                isAnomaly,
                flags,
            });
        } catch (err) {
            log.error({ err, market: market.contractAddress }, 'Settle-check error');
        }
    }

    return res.status(200).json({
        checked: results.length,
        anomalies: results.filter((r) => r.isAnomaly).length,
        results,
    });
}
