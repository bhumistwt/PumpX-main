import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';

// GET /api/intelligence/top-tokens
// Returns top tokens by ML blended probability (PumpScore)
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    // Find distinct token addresses from markets (filter out null/empty in JS)
    const rawTokens = await prisma.market.findMany({ select: { tokenAddress: true, stockTicker: true }, take: 200 });
    const tokenMap = new Map<string, string | null>();
    for (const r of rawTokens) {
      if (r.tokenAddress) tokenMap.set(r.tokenAddress, r.stockTicker ?? null);
    }
    const tokens = Array.from(tokenMap.entries()).map(([tokenAddress, stockTicker]) => ({ tokenAddress, stockTicker }));

    const now = new Date();
    const day24 = new Date(now.getTime() - 24 * 3600 * 1000);
    const day48 = new Date(now.getTime() - 48 * 3600 * 1000);

    const results: Array<any> = await Promise.all(tokens.map(async (t) => {
      try {
        const token = t.tokenAddress as string;
        const stockTicker = t.stockTicker ?? '';

        const marketRows = await prisma.market.findMany({ where: { tokenAddress: token }, select: { contractAddress: true } });
        const marketAddrs = marketRows.map(m => m.contractAddress);
        if (marketAddrs.length === 0) return null;

        const [marketCount, avg, recentAvg, prevAvg] = await Promise.all([
          prisma.market.count({ where: { tokenAddress: token } }),
          prisma.market.aggregate({ _avg: { blendedProbability: true, modelBaselineProbability: true }, where: { tokenAddress: token } }),
          prisma.modelPredictionLog.aggregate({ _avg: { probability: true }, where: { marketAddress: { in: marketAddrs }, createdAt: { gte: day24 } } }),
          prisma.modelPredictionLog.aggregate({ _avg: { probability: true }, where: { marketAddress: { in: marketAddrs }, createdAt: { gte: day48, lt: day24 } } }),
        ]);

        const blended = avg._avg.blendedProbability ?? avg._avg.modelBaselineProbability ?? 0.5;
        const recent = recentAvg._avg.probability ?? null;
        const prev = prevAvg._avg.probability ?? null;
        const change24 = (recent !== null && prev !== null) ? (recent - prev) : null;

        return { tokenAddress: token, stockTicker, marketCount, blended, change24 };
      } catch (e) {
        console.error('token aggregation error', t, e);
        return null;
      }
    }));

    // filter out nulls
    const filtered = results.filter(Boolean) as Array<any>;

    // Sort by blended desc and take top 10
    filtered.sort((a, b) => (b.blended ?? 0) - (a.blended ?? 0));

    const out = filtered.slice(0, 10).map(r => ({
      tokenAddress: r.tokenAddress,
      symbol: r.stockTicker || null,
      pumpScore: Math.round((r.blended ?? 0) * 10000) / 100, // 0-100 with 2 decimals
      change24: r.change24 !== null ? Math.round((r.change24) * 10000) / 100 : null,
      marketCount: r.marketCount,
    }));

    if (out.length === 0) return res.status(200).json({ data: [], message: 'Scores updating' });

    return res.status(200).json({ data: out });
  } catch (err: any) {
    console.error('intelligence top-tokens error', err);
    return res.status(500).json({ error: 'Failed to fetch intelligence leaderboard', message: err?.message, stack: err?.stack?.split('\n').slice(0,5) });
  }
}
