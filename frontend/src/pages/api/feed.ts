/**
 * PumpX — Social Proof Live Feed API
 *
 * GET /api/feed
 *
 * Returns recent bets/market activity for the live social proof ticker.
 * Query: ?limit=20&since=timestamp
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const since = req.query.since ? new Date(parseInt(req.query.since as string)) : undefined;

    // Fetch recent bets
    const recentBets = await prisma.bet.findMany({
      where: since ? { createdAt: { gt: since } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userAddress: true,
        side: true,
        amount: true,
        createdAt: true,
        marketAddress: true,
        market: {
          select: {
            question: true,
            tokenAddress: true,
            stockTicker: true,
          },
        },
      },
    });

    // Fetch recent market creations
    const recentMarkets = await prisma.market.findMany({
      where: since ? { createdAt: { gt: since } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.floor(limit / 2),
      select: {
        contractAddress: true,
        creatorAddress: true,
        question: true,
        tokenAddress: true,
        stockTicker: true,
        yesPool: true,
        noPool: true,
        createdAt: true,
      },
    });

    // Merge and sort by time
    const feed = [
      ...recentBets.map((bet) => ({
        type: 'bet' as const,
        id: bet.id,
        address: bet.userAddress,
        action: bet.side === 'YES' ? 'bet YES' : 'bet NO',
        amount: bet.amount,
        market: bet.market.question,
        marketAddress: bet.marketAddress,
        ticker: bet.market.stockTicker,
        timestamp: bet.createdAt.toISOString(),
      })),
      ...recentMarkets.map((m) => ({
        type: 'market_created' as const,
        id: m.contractAddress,
        address: m.creatorAddress,
        action: 'created market',
        amount: '0',
        market: m.question,
        marketAddress: m.contractAddress,
        ticker: m.stockTicker,
        timestamp: m.createdAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return res.status(200).json({ feed, count: feed.length });
  } catch (error: any) {
    console.error('Feed API error:', error);
    return res.status(500).json({ error: 'Failed to fetch feed' });
  }
}
