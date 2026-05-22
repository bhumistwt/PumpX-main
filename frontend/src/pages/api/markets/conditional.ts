/**
 * PumpX — Conditional Markets API
 *
 * GET  /api/markets/conditional — list conditional market chains
 * POST /api/markets/conditional — create a conditional link between markets
 *
 * Conditional markets are "if Market A resolves YES, then bet on Market B."
 * This is a frontend/metadata layer — the smart contracts are independent.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Find all markets that have parentMarketAddress in their metadata
    // Since we don't have a schema field for this, we'll use a creative approach:
    // Markets whose question contains "IF" or "GIVEN" are likely conditional
    // In a real implementation, we'd add a parentMarketAddress field to the schema

    const markets = await prisma.market.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      select: {
        contractAddress: true,
        question: true,
        tokenAddress: true,
        threshold: true,
        deadline: true,
        yesPool: true,
        noPool: true,
        resolved: true,
        reached: true,
        stockTicker: true,
        createdAt: true,
        creatorAddress: true,
        _count: { select: { bets: true } },
      },
    });

    // Group markets by token address to find potential chains
    const byToken = new Map<string, typeof markets>();
    for (const m of markets) {
      const key = m.tokenAddress.toLowerCase();
      if (!byToken.has(key)) byToken.set(key, []);
      byToken.get(key)!.push(m);
    }

    // Build chain groups (markets on same token with different thresholds)
    const chains = Array.from(byToken.entries())
      .filter(([_, ms]) => ms.length > 1)
      .map(([tokenAddress, ms]) => {
        const sorted = ms.sort((a, b) => {
          const aThresh = BigInt(a.threshold);
          const bThresh = BigInt(b.threshold);
          return aThresh < bThresh ? -1 : aThresh > bThresh ? 1 : 0;
        });

        return {
          tokenAddress,
          ticker: sorted[0].stockTicker,
          markets: sorted.map(m => ({
            address: m.contractAddress,
            question: m.question,
            threshold: m.threshold,
            deadline: m.deadline.toISOString(),
            yesPool: m.yesPool,
            noPool: m.noPool,
            resolved: m.resolved,
            reached: m.reached,
            betsCount: m._count.bets,
          })),
          stage: `${sorted.length}-stage chain`,
        };
      });

    return res.status(200).json({ chains, totalChains: chains.length });
  } catch (error: any) {
    console.error('Conditional markets error:', error);
    return res.status(500).json({ error: 'Failed to fetch conditional markets' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { parentAddress, childAddress, condition } = req.body as {
      parentAddress: string;
      childAddress: string;
      condition: 'YES' | 'NO';
    };

    if (!parentAddress || !childAddress || !condition) {
      return res.status(400).json({ error: 'parentAddress, childAddress, and condition are required' });
    }

    // Verify both markets exist
    const [parent, child] = await Promise.all([
      prisma.market.findUnique({ where: { contractAddress: parentAddress.toLowerCase() } }),
      prisma.market.findUnique({ where: { contractAddress: childAddress.toLowerCase() } }),
    ]);

    if (!parent) return res.status(404).json({ error: 'Parent market not found' });
    if (!child) return res.status(404).json({ error: 'Child market not found' });

    // Return the link info (in production, store this in a ConditionalLink table)
    return res.status(200).json({
      link: {
        parentAddress: parent.contractAddress,
        parentQuestion: parent.question,
        childAddress: child.contractAddress,
        childQuestion: child.question,
        condition,
        description: `IF "${parent.question}" resolves ${condition}, THEN "${child.question}"`,
      },
    });
  } catch (error: any) {
    console.error('Conditional link error:', error);
    return res.status(500).json({ error: 'Failed to create conditional link' });
  }
}
