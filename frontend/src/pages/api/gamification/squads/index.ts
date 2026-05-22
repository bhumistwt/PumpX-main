/**
 * GET  /api/gamification/squads           — List all squads
 * POST /api/gamification/squads           — Create a squad (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../../server/middleware';
import { createLogger } from '../../../../server/logger';

const log = createLogger('api:squads');

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const squads = await prisma.squad.findMany({
    include: {
      members: {
        select: { userAddress: true, role: true, joinedAt: true },
      },
      _count: { select: { members: true } },
    },
    orderBy: { totalXP: 'desc' },
  });

  res.status(200).json({ squads });
}

async function handleCreate(req: AuthenticatedRequest, res: NextApiResponse) {
  const { name, tag } = req.body;

  if (!name || !tag) {
    return res.status(400).json({ error: 'Missing name or tag' });
  }

  // Validate tag (3-6 chars alphanumeric)
  if (!/^[A-Za-z0-9]{3,6}$/.test(tag)) {
    return res.status(400).json({ error: 'Tag must be 3-6 alphanumeric characters' });
  }

  // Check uniqueness
  const existing = await prisma.squad.findFirst({
    where: { OR: [{ name }, { tag: tag.toUpperCase() }] },
  });

  if (existing) {
    return res.status(409).json({ error: 'Squad name or tag already taken' });
  }

  // Check user isn't already in a squad
  const membership = await prisma.squadMember.findFirst({
    where: { userAddress: req.user!.address },
  });

  if (membership) {
    return res.status(409).json({ error: 'You are already in a squad. Leave first.' });
  }

  // Generate a random invite code
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  const squad = await prisma.squad.create({
    data: {
      name,
      tag: tag.toUpperCase(),
      inviteCode,
      members: {
        create: {
          userAddress: req.user!.address,
          role: 'LEADER',
        },
      },
    },
    include: {
      members: true,
    },
  });

  log.info({ squad: squad.id, name, leader: req.user!.address }, 'Squad created');

  res.status(201).json({ squad });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req, res) => {
    if (req.method === 'POST') {
      return withAuth(handleCreate)(req, res);
    }
    return handleGet(req as any, res);
  }
);
