/**
 * POST /api/jobs/ml-update
 * Scheduled job: recompute ML probability for all active markets.
 * Protected by JOB_SECRET env var.
 *
 * Flags HIGH_DEVIATION if model vs market-implied spread > 15%.
 * Call every 5 minutes via Vercel Cron / GitHub Actions.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { mlClient } from '../../../lib/mlClient';
import { computeBlendedProbability, marketImpliedProbability } from '../../../lib/marketEngine';
import { createLogger } from '../../../server/logger';

const log = createLogger('jobs:ml-update');

const HIGH_DEVIATION_THRESHOLD = parseFloat(
    process.env.RISK_HIGH_DEVIATION_THRESHOLD ?? '0.15'
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Secret guard
    const secret = req.headers['x-job-secret'] ?? req.body?.secret;
    if (!process.env.JOB_SECRET || secret !== process.env.JOB_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const activeMarkets = await prisma.market.findMany({
        where: { resolved: false, deadline: { gt: now } },
        select: {
            contractAddress: true,
            stockTicker: true,
            yesPool: true,
            noPool: true,
        },
    });

    log.info({ count: activeMarkets.length }, 'Starting ML live update job');

    const results = [];
    for (const market of activeMarkets) {
        try {
            const result = await mlClient.predict({
                symbol: market.stockTicker ?? 'UNKNOWN',
                market: 'US',
            });

            // Market-implied probability
            const yesWei = BigInt(market.yesPool ?? '0');
            const noWei = BigInt(market.noPool ?? '0');
            const marketImplied = marketImpliedProbability(yesWei, noWei);

            // Blended pricing: 0.4 model + 0.6 market (configurable via ML_BLEND_WEIGHT)
            const blended = computeBlendedProbability(
                result.probability,
                marketImplied,
                mlClient.blendWeight
            );

            const deviation = Math.abs(result.probability - marketImplied);
            const flags = [...result.risk_flags];

            if (deviation > HIGH_DEVIATION_THRESHOLD) {
                flags.push(
                    `HIGH_DEVIATION: model=${result.probability.toFixed(3)} implied=${marketImplied.toFixed(3)}`
                );
                log.warn({ market: market.contractAddress, deviation }, 'HIGH_DEVIATION');
            }

            // Log prediction
            await prisma.modelPredictionLog.create({
                data: {
                    marketAddress: market.contractAddress,
                    probability: result.probability,
                    confidence: result.confidence,
                    signal: result.signal,
                    riskFlags: flags,
                    triggeredBy: 'LIVE_UPDATE',
                    rawScore: result.raw_score,
                },
            });

            // Update model columns + blended probability on the Market record
            await prisma.market.update({
                where: { contractAddress: market.contractAddress },
                data: {
                    modelBaselineProbability: result.probability,
                    modelConfidence: result.confidence,
                    modelSignal: result.signal,
                    modelRiskFlags: flags,
                    blendedProbability: blended,
                },
            });

            results.push({
                market: market.contractAddress,
                probability: result.probability,
                blendedProbability: blended,
                marketImplied,
                deviation,
                flags,
            });
        } catch (err) {
            log.error({ err, market: market.contractAddress }, 'ML update error for market');
        }
    }

    // Refresh ModelHealth aggregate
    await refreshModelHealth();

    log.info({ processed: results.length }, 'ML update job complete');
    return res.status(200).json({ processed: results.length, results });
}

async function refreshModelHealth() {
    try {
        const logs = await prisma.modelPredictionLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        if (logs.length === 0) return;

        const avgProb = logs.reduce((s, l) => s + l.probability, 0) / logs.length;
        const avgConf = logs.reduce((s, l) => s + l.confidence, 0) / logs.length;
        const overconfident = logs.filter((l) => l.confidence > 0.8).length / logs.length;

        await prisma.modelHealth.upsert({
            where: { id: 'main' },
            create: {
                id: 'main',
                avgProbability: avgProb,
                avgConfidence: avgConf,
                overconfidenceRate: overconfident,
                totalPredictions: logs.length,
            },
            update: {
                avgProbability: avgProb,
                avgConfidence: avgConf,
                overconfidenceRate: overconfident,
                totalPredictions: logs.length,
            },
        });
    } catch (err) {
        // Non-fatal
        log.warn({ err }, 'Failed to refresh ModelHealth');
    }
}
