/**
 * GET /api/ml/health
 * Admin-only: model health and drift status from the Python microservice.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { mlClient } from '../../../lib/mlClient';
import { prisma } from '../../../server/db';
import {
    compose,
    withErrorHandler,
    withMethod,
    withRole,
} from '../../../server/middleware';
import type { AuthenticatedRequest } from '../../../server/middleware';

async function handler(_req: AuthenticatedRequest, res: NextApiResponse) {
    const [health, drift, latestDriftLog] = await Promise.all([
        mlClient.getHealth(),
        mlClient.getDriftStatus(),
        prisma.modelDriftLog.findFirst({ orderBy: { checkedAt: 'desc' } }).catch(() => null),
    ]);

    return res.status(200).json({
        service: {
            reachable: health !== null,
            ...(health ?? { status: 'unreachable', model_loaded: false }),
        },
        drift: drift ?? { status: 'unavailable' },
        lastDriftEvent: latestDriftLog,
        serviceUrl: mlClient.serviceUrl,
        blendWeight: mlClient.blendWeight,
    });
}

export default compose(
    withErrorHandler,
    withMethod('GET'),
    withRole('ADMIN')
)(handler);
