/**
 * GET    /api/gamification/squads/[id]         — Get squad detail
 * POST   /api/gamification/squads/[id]         — Join squad (auth'd)
 * DELETE /api/gamification/squads/[id]         — Leave squad (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../../server/middleware';
import { createLogger } from '../../../../server/logger';

const log = createLogger('api:squads:id');

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  const squad = await prisma.squad.findUnique({
    where: { id: id as string },
    include: {
      members: {
        include: {
          user: {
            select: {
              address: true,
              _count: { select: { bets: true } },
            },
          },
        },
      },
      _count: { select: { members: true } },
    },
  });

  if (!squad) {
    return res.status(404).json({ error: 'Squad not found' });
  }

  res.status(200).json({ squad });
}

async function handleJoin(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;
  const address = req.user!.address;

  // Check squad exists
  const squad = await prisma.squad.findUnique({
    where: { id: id as string },
    include: { _count: { select: { members: true } } },
  });

  if (!squad) {
    return res.status(404).json({ error: 'Squad not found' });
  }

  // Max 20 members
  if (squad._count.members >= 20) {
    return res.status(409).json({ error: 'Squad is full (max 20 members)' });
  }

  // Check not already in a squad
  const existing = await prisma.squadMember.findFirst({
    where: { userAddress: address },
  });

  if (existing) {
    return res.status(409).json({ error: 'Already in a squad' });
  }

  await prisma.squadMember.create({
    data: {
      squadId: id as string,
      userAddress: address,
      role: 'MEMBER',
    },
  });

  log.info({ squad: id, address }, 'User joined squad');

  res.status(200).json({ message: 'Joined squad' });
}

async function handleLeave(req: AuthenticatedRequest, res: NextApiResponse) {
  const { id } = req.query;
  const address = req.user!.address;

  const membership = await prisma.squadMember.findFirst({
    where: { squadId: id as string, userAddress: address },
  });

  if (!membership) {
    return res.status(404).json({ error: 'Not a member of this squad' });
  }

  // Leader can't leave — must transfer leadership or disband
  if (membership.role === 'LEADER') {
    const memberCount = await prisma.squadMember.count({ where: { squadId: id as string } });
    if (memberCount > 1) {
      return res.status(400).json({ error: 'Leader must transfer leadership before leaving' });
    }
    // Last member — disband squad
    await prisma.squadMember.delete({ where: { id: membership.id } });
    await prisma.squad.delete({ where: { id: id as string } });
    log.info({ squad: id, address }, 'Squad disbanded');
    return res.status(200).json({ message: 'Squad disbanded' });
  }

  await prisma.squadMember.delete({ where: { id: membership.id } });

  log.info({ squad: id, address }, 'User left squad');

  res.status(200).json({ message: 'Left squad' });
}

export default compose(withErrorHandler, withMethod('GET', 'POST', 'DELETE'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleJoin)(req as any, res);
    }
    if (req.method === 'DELETE') {
      return withAuth(handleLeave)(req as any, res);
    }
    return handleGet(req, res);
  }
);
