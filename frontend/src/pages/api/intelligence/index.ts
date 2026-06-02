import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { getTrendingNarratives } from '../../../lib/ai/narrativeEngine';
import { getRecentWhaleAlerts } from '../../../server/whaleAlerts';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';

async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const [narratives, whaleRows] = await Promise.all([
    getTrendingNarratives(),
    getRecentWhaleAlerts(10),
  ]);

  const now = new Date();
  const opportunities = await prisma.market.findMany({
    where: {
      resolved: false,
      deadline: { gt: now },
    },
    orderBy: [{ yesPool: 'desc' }],
    take: 8,
    select: {
      contractAddress: true,
      question: true,
      tokenAddress: true,
      yesPool: true,
      noPool: true,
      blendedProbability: true,
      deadline: true,
      stockTicker: true,
    },
  });

  const whaleAlerts = whaleRows.map((w) => ({
    id: w.id,
    walletAddress: w.walletAddress,
    action: w.action,
    tokenAddress: w.tokenAddress,
    amount: w.amount,
    amountEth: (Number(BigInt(w.amount)) / 1e18).toFixed(4),
    txHash: w.txHash,
    createdAt: w.createdAt.toISOString(),
  }));

  const opportunityCards = opportunities
    .map((m) => {
      const yes = BigInt(m.yesPool || '0');
      const no = BigInt(m.noPool || '0');
      const total = yes + no;
      const yesPct = total > 0n ? Number((yes * 100n) / total) : 50;
      return {
        marketId: m.contractAddress,
        question: m.question,
        tokenAddress: m.tokenAddress,
        stockTicker: m.stockTicker,
        yesPercent: yesPct,
        volumeEth: (Number(total) / 1e18).toFixed(4),
        pumpScore: m.blendedProbability != null
          ? Math.round(m.blendedProbability * 100)
          : null,
        deadline: m.deadline.toISOString(),
      };
    })
    .sort((a, b) => parseFloat(b.volumeEth) - parseFloat(a.volumeEth));

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  return res.status(200).json({
    narratives,
    whaleAlerts,
    opportunities: opportunityCards,
  });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
