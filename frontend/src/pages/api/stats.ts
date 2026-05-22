/**
 * GET /api/stats — Public platform statistics
 * Returns real counts from the DB for the homepage.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../server/db';
import { withErrorHandler, compose } from '../../server/middleware';

async function handler(_req: NextApiRequest, res: NextApiResponse) {
    const [marketCount, userCount, betCount] = await Promise.all([
        prisma.market.count({ where: { resolved: false, deadline: { gt: new Date() } } }),
        prisma.user.count(),
        prisma.bet.count(),
    ]);

    // Total ETH volume = sum of yesPool + noPool across all markets
    const pools = await prisma.market.findMany({ select: { yesPool: true, noPool: true } });
    let totalWei = BigInt(0);
    for (const m of pools) {
        try { totalWei += BigInt(m.yesPool) + BigInt(m.noPool); } catch { }
    }
    const totalEth = Number(totalWei) / 1e18;

    return res.status(200).json({
        activeMarkets: marketCount,
        totalUsers: userCount,
        totalBets: betCount,
        totalEthVolume: totalEth,
    });
}

export default compose(withErrorHandler)(handler);
