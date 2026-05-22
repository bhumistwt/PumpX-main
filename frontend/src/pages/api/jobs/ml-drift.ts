/**
 * POST /api/jobs/ml-drift
 * Daily drift monitoring: reads PSI from the Python microservice,
 * logs to ModelDriftLog, and updates ModelHealth.isDegrading.
 * Protected by JOB_SECRET env var.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { mlClient } from '../../../lib/mlClient';
import { createLogger } from '../../../server/logger';

const log = createLogger('jobs:ml-drift');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = req.headers['x-job-secret'] ?? req.body?.secret;
    if (!process.env.JOB_SECRET || secret !== process.env.JOB_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const drift = await mlClient.getDriftStatus();

    if (!drift) {
        log.warn('ML service unreachable during drift check');
        return res.status(200).json({
            checked: true,
            psi: null,
            status: 'ML_SERVICE_UNREACHABLE',
            isDegrading: false,
        });
    }

    const isDegrading = drift.is_degrading;

    // Write to drift log
    await prisma.modelDriftLog.create({
        data: {
            psiScore: drift.psi,
            status: drift.status,
            isDegrading,
        },
    });

    // Update ModelHealth singleton
    await prisma.modelHealth.upsert({
        where: { id: 'main' },
        create: {
            id: 'main',
            lastDriftCheck: new Date(),
            lastDriftPsi: drift.psi,
            isDegrading,
        },
        update: {
            lastDriftCheck: new Date(),
            lastDriftPsi: drift.psi,
            isDegrading,
        },
    });

    if (isDegrading) {
        log.warn({ psi: drift.psi, status: drift.status }, 'MODEL_DEGRADING flagged by drift monitor');
    } else {
        log.info({ psi: drift.psi, status: drift.status }, 'Drift check complete');
    }

    return res.status(200).json({
        checked: true,
        psi: drift.psi,
        status: drift.status,
        isDegrading,
        windowReady: drift.ready,
        recentMean: drift.recent_window_mean,
        recentStd: drift.recent_window_std,
    });
}
