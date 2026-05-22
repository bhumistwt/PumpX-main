/**
 * GET  /api/gamification/battles           — List active/recent battles
 * POST /api/gamification/battles           — Create a battle challenge (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:battles');

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const status = (req.query.status as string) || 'active';
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const where: any = {};
  if (status === 'active') {
    where.status = 'ACTIVE';
    where.expiresAt = { gt: new Date() };
  } else if (status === 'completed') {
    where.status = 'SETTLED';
  }

  const battles = await prisma.battle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.status(200).json({ battles });
}

async function handleCreate(req: AuthenticatedRequest, res: NextApiResponse) {
  const { opponentAddress, marketAddress, side, stakeXP, durationHours } = req.body;

  if (!opponentAddress || !marketAddress || !durationHours) {
    return res.status(400).json({ error: 'Missing required fields: opponentAddress, marketAddress, durationHours' });
  }

  const creator = req.user!.address;
  const opponent = opponentAddress.toLowerCase();

  if (creator === opponent) {
    return res.status(400).json({ error: 'Cannot battle yourself' });
  }

  // Validate side
  const creatorSide = (side || 'YES').toUpperCase();
  if (!['YES', 'NO'].includes(creatorSide)) {
    return res.status(400).json({ error: 'Side must be YES or NO' });
  }

  // Ensure opponent exists
  const opponentUser = await prisma.user.findUnique({ where: { address: opponent } });
  if (!opponentUser) {
    return res.status(404).json({ error: 'Opponent not found.' });
  }

  // Check for active battle between same users
  const existingBattle = await prisma.battle.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { creatorAddress: creator, challengerAddress: opponent },
        { creatorAddress: opponent, challengerAddress: creator },
      ],
    },
  });

  if (existingBattle) {
    return res.status(409).json({ error: 'Active battle already exists between these users' });
  }

  const hours = Math.min(168, Math.max(1, parseInt(durationHours))); // 1h to 1 week
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const battle = await prisma.battle.create({
    data: {
      creatorAddress: creator,
      challengerAddress: opponent,
      marketAddress: marketAddress.toLowerCase(),
      creatorSide: creatorSide as any,
      stakeXP: parseInt(stakeXP) || 0,
      status: 'PENDING',
      expiresAt,
    },
  });

  log.info({ battle: battle.id, creator, opponent, marketAddress }, 'Battle created');

  res.status(201).json({ battle });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleCreate)(req as any, res);
    }
    return handleGet(req, res);
  }
);
