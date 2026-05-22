/**
 * GET /api/markets/[address] — Get a single market by contract address
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query;

  if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid market address' });
  }

  const market = await prisma.market.findUnique({
    where: { contractAddress: address.toLowerCase() },
    include: {
      bets: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          userAddress: true,
          side: true,
          amount: true,
          txHash: true,
          createdAt: true,
        },
      },
      _count: { select: { bets: true } },
    },
  });

  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  res.status(200).json({ market });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
