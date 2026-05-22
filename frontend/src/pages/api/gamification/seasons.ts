/**
 * GET /api/gamification/seasons — Get current season + leaderboard
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const now = new Date();

  // Find active season
  let season = await prisma.season.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
    include: {
      entries: {
        orderBy: { xp: 'desc' },
        take: 50,
        select: {
          userAddress: true,
          xp: true,
          rank: true,
        },
      },
      _count: { select: { entries: true } },
    },
  });

  if (!season) {
    return res.status(200).json({
      season: null,
      message: 'No active season',
    });
  }

  res.status(200).json({ season });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
