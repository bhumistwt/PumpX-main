import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';
import { computeWalletDNA } from '../../../lib/walletDNA';
import { getWalletAiInsights } from '../../../lib/ai/walletInsights';
import { isValidEthAddress } from '../../../lib/addresses';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const address = String(req.query.address || '').toLowerCase();

  if (!isValidEthAddress(address)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const bets = await prisma.bet.findMany({
    where: { userAddress: address },
    include: {
      market: {
        select: {
          contractAddress: true,
          question: true,
          resolved: true,
          reached: true,
          deadline: true,
          yesPool: true,
          noPool: true,
          stockTicker: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const stats = computeWalletDNA(address, bets);
  const aiInsights = await getWalletAiInsights(stats);

  return res.status(200).json({
    stats,
    aiInsights,
  });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
