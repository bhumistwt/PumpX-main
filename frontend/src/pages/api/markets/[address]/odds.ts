/**
 * GET /api/markets/[address]/odds
 * Returns real-time YES/NO odds + pool data for a specific market.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../../server/middleware';
import { calculateOdds, formatEth } from '../../../../lib/marketEngine';
import { getSentimentLabel } from '../../../../lib/sentimentUtils';

async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { address } = req.query;

    if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid market address' });
    }

    const market = await prisma.market.findUnique({
        where: { contractAddress: address.toLowerCase() },
        select: {
            contractAddress: true,
            question: true,
            yesPool: true,
            noPool: true,
            resolved: true,
            reached: true,
            disputed: true,
            paused: true,
            deadline: true,
            threshold: true,
            latestSupply: true,
        },
    });

    if (!market) {
        return res.status(404).json({ error: 'Market not found' });
    }

    const yesPool = BigInt(market.yesPool);
    const noPool = BigInt(market.noPool);
    const total = yesPool + noPool;

    const { yesOdds, noOdds, impliedYesPct, impliedNoPct } = calculateOdds(yesPool, noPool);
    const sentiment = getSentimentLabel(impliedYesPct);

    return res.status(200).json({
        address: market.contractAddress,
        question: market.question,
        yesPool: formatEth(yesPool),
        noPool: formatEth(noPool),
        totalPool: formatEth(total),
        impliedYesPct,
        impliedNoPct,
        yesOdds,
        noOdds,
        sentiment: sentiment.label,
        sentimentEmoji: sentiment.emoji,
        resolved: market.resolved,
        reached: market.reached,
        disputed: market.disputed,
        paused: market.paused,
        deadline: market.deadline,
        updatedAt: new Date().toISOString(),
    });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
