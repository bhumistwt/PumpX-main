/**
 * GET  /api/gamification/badges?address=0x...  — Get user's earned badges
 * POST /api/gamification/badges                 — Check & award new badges (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:badges');

// Badge definitions — server-authoritative
const BADGE_DEFINITIONS = [
  { id: 'first_bet', name: 'First Bet', description: 'Place your first prediction', icon: '🎯', xpReward: 50 },
  { id: 'market_creator', name: 'Market Creator', description: 'Create your first market', icon: '🏗️', xpReward: 100 },
  { id: 'winning_streak_3', name: 'Lucky 3', description: 'Win 3 predictions in a row', icon: '🍀', xpReward: 75 },
  { id: 'winning_streak_5', name: 'High Roller', description: 'Win 5 predictions in a row', icon: '🎰', xpReward: 150 },
  { id: 'volume_whale', name: 'Whale', description: 'Bet more than 1 ETH total', icon: '🐋', xpReward: 200 },
  { id: 'streak_7', name: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: '⚔️', xpReward: 100 },
  { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '👑', xpReward: 300 },
  { id: 'bets_10', name: 'Active Trader', description: 'Place 10 bets', icon: '📊', xpReward: 50 },
  { id: 'bets_50', name: 'Professional', description: 'Place 50 bets', icon: '💼', xpReward: 150 },
  { id: 'bets_100', name: 'Centurion', description: 'Place 100 bets', icon: '🏛️', xpReward: 250 },
] as const;

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  return handleCheck(req as AuthenticatedRequest, res);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const earned = await prisma.userBadge.findMany({
    where: { userAddress: address },
    orderBy: { unlockedAt: 'desc' },
  });

  const badges = BADGE_DEFINITIONS.map(def => {
    const userBadge = earned.find((b: any) => b.badgeId === def.id);
    return {
      ...def,
      earned: !!userBadge,
      earnedAt: userBadge?.unlockedAt || null,
    };
  });

  res.status(200).json({
    address,
    badges,
    totalEarned: earned.length,
    totalAvailable: BADGE_DEFINITIONS.length,
  });
}

/** Check user's activity and award any newly-earned badges */
async function handleCheck(req: AuthenticatedRequest, res: NextApiResponse) {
  const address = req.user!.address;
  const newlyEarned: string[] = [];

  // Get existing badges
  const existingBadges = await prisma.userBadge.findMany({
    where: { userAddress: address },
    select: { badgeId: true },
  });
  const earnedSet = new Set(existingBadges.map((b: any) => b.badgeId));

  // Get user stats
  const [betCount, claimCount, bets, streak, marketCount] = await Promise.all([
    prisma.bet.count({ where: { userAddress: address } }),
    prisma.claim.count({ where: { userAddress: address } }),
    prisma.bet.findMany({ where: { userAddress: address }, select: { amount: true } }),
    prisma.streak.findUnique({ where: { userAddress: address } }),
    prisma.market.count({ where: { creatorAddress: address } }),
  ]);

  // Sum string amounts for volume
  const totalVolumeWei = bets.reduce((acc: bigint, b: { amount: string }) => acc + BigInt(b.amount || '0'), BigInt(0));
  const oneEthWei = BigInt('1000000000000000000');

  // Check conditions
  const checks: [string, boolean][] = [
    ['first_bet', betCount >= 1],
    ['market_creator', marketCount >= 1],
    ['winning_streak_3', claimCount >= 3],
    ['winning_streak_5', claimCount >= 5],
    ['volume_whale', totalVolumeWei >= oneEthWei],
    ['streak_7', (streak?.longestStreak || 0) >= 7],
    ['streak_30', (streak?.longestStreak || 0) >= 30],
    ['bets_10', betCount >= 10],
    ['bets_50', betCount >= 50],
    ['bets_100', betCount >= 100],
  ];

  for (const [badgeId, condition] of checks) {
    if (condition && !earnedSet.has(badgeId)) {
      const def = BADGE_DEFINITIONS.find(d => d.id === badgeId)!;

      await prisma.userBadge.create({
        data: {
          userAddress: address,
          badgeId,
        },
      });

      // Award XP
      await prisma.xPTransaction.create({
        data: {
          userAddress: address,
          amount: def.xpReward,
          reason: `Badge earned: ${def.name}`,
        },
      });

      newlyEarned.push(badgeId);
      log.info({ address, badge: badgeId, xp: def.xpReward }, 'Badge awarded');
    }
  }

  res.status(200).json({
    newlyEarned,
    totalBadges: existingBadges.length + newlyEarned.length,
  });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleCheck)(req as any, res);
    }
    return handleGet(req, res);
  }
);
