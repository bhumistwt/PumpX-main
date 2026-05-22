/**
 * PumpX — Market Sentiment Heatmap API
 *
 * GET /api/markets/heatmap
 *
 * Returns all active markets with YES/NO ratios for heatmap visualization.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const markets = await prisma.market.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        contractAddress: true,
        question: true,
        tokenAddress: true,
        stockTicker: true,
        threshold: true,
        deadline: true,
        yesPool: true,
        noPool: true,
        latestSupply: true,
        initialSupply: true,
        createdAt: true,
        _count: { select: { bets: true } },
      },
    });

    const heatmapData = markets.map((m) => {
      const yesWei = BigInt(m.yesPool);
      const noWei = BigInt(m.noPool);
      const totalWei = yesWei + noWei;
      const yesRatio = totalWei > 0n ? Number((yesWei * 10000n) / totalWei) / 100 : 50;
      const totalEth = Number(totalWei) / 1e18;

      // Calculate time remaining
      const deadlineTime = new Date(m.deadline).getTime();
      const now = Date.now();
      const timeRemainingMs = Math.max(0, deadlineTime - now);
      const hoursRemaining = Math.floor(timeRemainingMs / 3_600_000);
      const daysRemaining = Math.floor(hoursRemaining / 24);

      return {
        address: m.contractAddress,
        question: m.question,
        ticker: m.stockTicker,
        tokenAddress: m.tokenAddress,
        yesRatio,
        noRatio: 100 - yesRatio,
        totalVolume: totalEth,
        betsCount: m._count.bets,
        deadline: m.deadline.toISOString(),
        daysRemaining,
        hoursRemaining: hoursRemaining % 24,
        isExpiring: daysRemaining < 1,
        threshold: m.threshold,
        latestSupply: m.latestSupply,
        initialSupply: m.initialSupply,
      };
    });

    // Calculate aggregate sentiment
    const totalYes = heatmapData.reduce((s, m) => s + m.yesRatio * m.totalVolume, 0);
    const totalVol = heatmapData.reduce((s, m) => s + m.totalVolume, 0);
    const overallSentiment = totalVol > 0 ? totalYes / totalVol : 50;

    return res.status(200).json({
      markets: heatmapData,
      aggregate: {
        totalMarkets: heatmapData.length,
        overallSentiment: Math.round(overallSentiment * 100) / 100,
        totalVolume: totalVol,
        totalBets: heatmapData.reduce((s, m) => s + m.betsCount, 0),
      },
    });
  } catch (error: any) {
    console.error('Heatmap API error:', error);
    return res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
}
