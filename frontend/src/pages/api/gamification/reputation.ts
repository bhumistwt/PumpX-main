/**
 * GET  /api/gamification/reputation?address=0x...  — Get user reputation score + events
 * POST /api/gamification/reputation                 — Record reputation event (server-side)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:reputation');

// Reputation event weights
const REPUTATION_WEIGHTS: Record<string, number> = {
  BET_PLACED: 1,
  BET_WON: 5,
  BET_LOST: -2,
  MARKET_CREATED: 3,
  MARKET_RESOLVED_CORRECTLY: 10,
  STREAK_7: 5,
  STREAK_30: 15,
  BADGE_EARNED: 2,
  SQUAD_JOIN: 1,
  CHALLENGE_COMPLETED: 2,
  REPORTED: -10,
  DISPUTE_LOST: -20,
};

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const [reputation, events] = await Promise.all([
    prisma.reputation.findUnique({ where: { userAddress: address } }),
    prisma.reputationEvent.findMany({
      where: { toAddress: address },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const score = reputation?.score || 0;
  const tier = getRepTier(score);

  res.status(200).json({
    address,
    score,
    tier,
    events,
  });
}

function getRepTier(score: number): string {
  if (score >= 1000) return 'LEGENDARY';
  if (score >= 500) return 'EXPERT';
  if (score >= 200) return 'TRUSTED';
  if (score >= 50) return 'ESTABLISHED';
  if (score >= 0) return 'NEWCOMER';
  return 'SUSPICIOUS';
}

async function handleRecord(req: AuthenticatedRequest, res: NextApiResponse) {
  const { address, eventType, details } = req.body;

  if (!address || !eventType) {
    return res.status(400).json({ error: 'Missing address or eventType' });
  }

  const targetAddress = address.toLowerCase();
  const weight = REPUTATION_WEIGHTS[eventType];

  if (weight === undefined) {
    return res.status(400).json({ error: `Invalid event type. Valid: ${Object.keys(REPUTATION_WEIGHTS).join(', ')}` });
  }

  // Only allow self-reporting or admin
  if (req.user!.address !== targetAddress && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Map eventType to ReputationType enum (UPVOTE or FLAG)
  const repType = weight >= 0 ? 'UPVOTE' : 'FLAG';

  // Record the event
  await prisma.reputationEvent.create({
    data: {
      fromAddress: req.user!.address,
      toAddress: targetAddress,
      type: repType as any,
      reason: details || `${eventType}`,
    },
  });

  // Upsert reputation score
  const updated = await prisma.reputation.upsert({
    where: { userAddress: targetAddress },
    update: { score: { increment: weight } },
    create: { userAddress: targetAddress, score: Math.max(0, weight) },
  });

  log.info({ address: targetAddress, event: eventType, delta: weight, newScore: updated.score }, 'Reputation updated');

  res.status(200).json({
    score: updated.score,
    tier: getRepTier(updated.score),
    delta: weight,
  });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleRecord)(req as any, res);
    }
    return handleGet(req, res);
  }
);
