/**
 * GET  /api/gamification/challenges?address=0x...  — Get active challenges + progress
 * POST /api/gamification/challenges                 — Update challenge progress (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:challenges');

// Challenge definitions — rotate daily by using date-based seed
function getDailyChallenges(): { id: string; name: string; description: string; target: number; xpReward: number; type: string }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);

  const challengePool = [
    { id: 'bet_3', name: 'Triple Bet', description: 'Place 3 bets today', target: 3, xpReward: 30, type: 'bet_count' },
    { id: 'bet_volume', name: 'Big Spender', description: 'Bet at least 0.01 ETH total today', target: 1, xpReward: 40, type: 'bet_volume' },
    { id: 'visit_markets', name: 'Market Explorer', description: 'View 5 different markets', target: 5, xpReward: 20, type: 'market_views' },
    { id: 'check_in', name: 'Show Up', description: 'Check in today', target: 1, xpReward: 10, type: 'check_in' },
    { id: 'bet_yes_no', name: 'Both Sides', description: 'Place both YES and NO bets', target: 2, xpReward: 25, type: 'bet_diversity' },
    { id: 'first_market', name: 'Creator', description: 'Create a prediction market', target: 1, xpReward: 50, type: 'create_market' },
  ];

  // Rotate: pick 3 daily challenges based on day of year
  const selected = [];
  for (let i = 0; i < 3; i++) {
    selected.push(challengePool[(dayOfYear + i) % challengePool.length]);
  }

  return selected;
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string)?.toLowerCase();
  const challenges = getDailyChallenges();

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    // Return challenges without progress
    return res.status(200).json({ challenges: challenges.map(c => ({ ...c, progress: 0, completed: false })) });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  // Get today's progress for this user
  const progressRecords = await prisma.challengeProgress.findMany({
    where: {
      userAddress: address,
      date: todayStr,
    },
  });

  const progressMap = new Map(progressRecords.map((p: any) => [p.challengeId, p]));

  const enriched = challenges.map((c: any) => {
    const p = progressMap.get(c.id) as any;
    return {
      ...c,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? false,
    };
  });

  res.status(200).json({ challenges: enriched });
}

async function handleUpdate(req: AuthenticatedRequest, res: NextApiResponse) {
  const { challengeId, progress } = req.body;
  const address = req.user!.address;

  if (!challengeId || progress === undefined) {
    return res.status(400).json({ error: 'Missing challengeId or progress' });
  }

  const challenges = getDailyChallenges();
  const challenge = challenges.find(c => c.id === challengeId);

  if (!challenge) {
    return res.status(404).json({ error: 'Challenge not found or not active today' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const existing = await prisma.challengeProgress.findUnique({
    where: {
      userAddress_challengeId_date: {
        userAddress: address,
        challengeId,
        date: todayStr,
      },
    },
  });

  if (existing?.completed) {
    return res.status(200).json({ message: 'Challenge already completed', xpAwarded: 0 });
  }

  const newProgress = Math.max(existing?.progress || 0, progress);
  const isCompleted = newProgress >= challenge.target;

  await prisma.challengeProgress.upsert({
    where: {
      userAddress_challengeId_date: {
        userAddress: address,
        challengeId,
        date: todayStr,
      },
    },
    update: {
      progress: newProgress,
      completed: isCompleted,
    },
    create: {
      userAddress: address,
      challengeId,
      date: todayStr,
      progress: newProgress,
      target: challenge.target,
      completed: isCompleted,
    },
  });

  let xpAwarded = 0;
  if (isCompleted && !existing?.completed) {
    await prisma.xPTransaction.create({
      data: {
        userAddress: address,
        amount: challenge.xpReward,
        reason: `Challenge completed: ${challenge.name}`,
      },
    });
    xpAwarded = challenge.xpReward;

    log.info({ address, challenge: challengeId, xp: xpAwarded }, 'Challenge completed');
  }

  res.status(200).json({
    challengeId,
    progress: newProgress,
    target: challenge.target,
    completed: isCompleted,
    xpAwarded,
  });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleUpdate)(req as any, res);
    }
    return handleGet(req, res);
  }
);
