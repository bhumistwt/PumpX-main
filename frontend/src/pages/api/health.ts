/**
 * GET /api/health — Health check endpoint for monitoring
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    checks,
  });
}
