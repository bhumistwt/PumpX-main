/**
 * GET /api/ml/stats
 * Admin-only: aggregated model statistics from the ModelHealth singleton
 * and recent ModelPredictionLog entries.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import {
    compose,
    withErrorHandler,
    withMethod,
    withRole,
} from '../../../server/middleware';
import type { AuthenticatedRequest } from '../../../server/middleware';

async function handler(_req: AuthenticatedRequest, res: NextApiResponse) {
    const [health, recentLogs, driftLogs] = await Promise.all([
        prisma.modelHealth.findUnique({ where: { id: 'main' } }).catch(() => null),
        prisma.modelPredictionLog
            .findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
            .catch(() => []),
        prisma.modelDriftLog
            .findMany({ orderBy: { checkedAt: 'desc' }, take: 10 })
            .catch(() => []),
    ]);

    // Compute live confidence distribution from recent logs
    const confidenceBuckets = { low: 0, medium: 0, high: 0 };
    for (const log of recentLogs) {
        if (log.confidence < 0.33) confidenceBuckets.low++;
        else if (log.confidence < 0.67) confidenceBuckets.medium++;
        else confidenceBuckets.high++;
    }

    return res.status(200).json({
        health: health ?? {
            id: 'main',
            avgProbability: 0.5,
            avgConfidence: 0,
            overconfidenceRate: 0,
            totalPredictions: 0,
            lastDriftCheck: null,
            lastDriftPsi: null,
            isDegrading: false,
        },
        recentPredictions: recentLogs,
        confidenceBuckets,
        driftHistory: driftLogs,
    });
}

export default compose(
    withErrorHandler,
    withMethod('GET'),
    withRole('ADMIN')
)(handler);
