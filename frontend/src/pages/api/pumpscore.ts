/**
 * GET /api/pumpscore
 * Returns the global PumpScore (0-100) computed from active market pools.
 * Also returns the breakdown of top markets by sentiment.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../server/db';
import { withErrorHandler, withMethod, compose } from '../../server/middleware';
import { aggregatePumpScore } from '../../lib/marketEngine';
import { getSentimentLabel } from '../../lib/sentimentUtils';

async function handler(_req: NextApiRequest, res: NextApiResponse) {
    const markets = await prisma.market.findMany({
        where: { resolved: false, paused: false },
        select: {
            contractAddress: true,
            question: true,
            yesPool: true,
            noPool: true,
            resolved: true,
            deadline: true,
        },
        orderBy: [{ yesPool: 'desc' }, { noPool: 'desc' }],
        take: 200,
    });

    const score = aggregatePumpScore(markets);
    const sentiment = getSentimentLabel(score);

    const breakdown = markets.slice(0, 10).map((m) => {
        const yes = BigInt(m.yesPool);
        const no = BigInt(m.noPool);
        const total = yes + no;
        const yesPct = total > 0n ? Number((yes * 100n) / total) : 50;

        return {
            address: m.contractAddress,
            question: m.question,
            yesPct,
            volume: Number(total) / 1e18,
            deadline: m.deadline,
        };
    });

    res.status(200).json({
        score,
        sentiment: sentiment.label,
        emoji: sentiment.emoji,
        color: sentiment.hexColor,
        totalActiveMarkets: markets.length,
        breakdown,
        updatedAt: new Date().toISOString(),
    });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
