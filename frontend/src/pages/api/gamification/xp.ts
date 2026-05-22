/**
 * GET  /api/gamification/xp?address=0x...  — Get user's XP, level, history
 * POST /api/gamification/xp                 — Award XP (server-side only, after verified action)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:xp');

// XP level thresholds (same as original constants but server-side)
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];

function getLevel(totalXP: number): { level: number; currentXP: number; nextThreshold: number } {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) {
      level = i;
      break;
    }
  }
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[level] * 2;
  return { level, currentXP: totalXP, nextThreshold };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  return handleAward(req as AuthenticatedRequest, res);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const [xpRecords, totalResult] = await Promise.all([
    prisma.xPTransaction.findMany({
      where: { userAddress: address },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.xPTransaction.aggregate({
      where: { userAddress: address },
      _sum: { amount: true },
    }),
  ]);

  const totalXP = totalResult._sum.amount || 0;
  const levelInfo = getLevel(totalXP);

  res.status(200).json({
    address,
    ...levelInfo,
    history: xpRecords,
  });
}

async function handleAward(req: AuthenticatedRequest, res: NextApiResponse) {
  const { address, amount, reason } = req.body;

  if (!address || !amount || !reason) {
    return res.status(400).json({ error: 'Missing address, amount, or reason' });
  }

  const targetAddress = address.toLowerCase();

  // Only award XP to the authenticated user themselves (or admin can award to anyone)
  if (req.user!.address !== targetAddress && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Can only award XP to your own address' });
  }

  // Ensure user exists
  await prisma.user.upsert({
    where: { address: targetAddress },
    update: {},
    create: { address: targetAddress },
  });

  const xpTx = await prisma.xPTransaction.create({
    data: {
      userAddress: targetAddress,
      amount: parseInt(amount),
      reason,
    },
  });

  log.info({ address: targetAddress, amount, reason }, 'XP awarded');

  const totalResult = await prisma.xPTransaction.aggregate({
    where: { userAddress: targetAddress },
    _sum: { amount: true },
  });

  const totalXP = totalResult._sum.amount || 0;
  const levelInfo = getLevel(totalXP);

  res.status(200).json({
    xpTransaction: xpTx,
    ...levelInfo,
  });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleAward)(req as any, res);
    }
    return handleGet(req, res);
  }
);
