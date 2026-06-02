/**
 * GET /api/user/portfolio  — Current user's market positions and P&L
 * Requires authentication (iron-session).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import {
    withErrorHandler,
    withAuth,
    withMethod,
    compose,
    type AuthenticatedRequest,
} from '../../../server/middleware';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    const address = req.user!.address;

    // Fetch all bets by this user, joined with market data
    // Also fetch claims to determine claimed status
    const [bets, claims, referrals] = await Promise.all([
        prisma.bet.findMany({
            where: { userAddress: address },
            include: {
                market: {
                    select: {
                        contractAddress: true,
                        question: true,
                        tokenAddress: true,
                        threshold: true,
                        deadline: true,
                        resolved: true,
                        reached: true,
                        yesPool: true,
                        noPool: true,
                        chainId: true,
                        stockTicker: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.claim.findMany({
            where: { userAddress: address },
            select: { marketAddress: true },
        }),
        prisma.referral.findMany({
            where: { referrerId: address },
            select: { volumeGenerated: true, refereeId: true },
        }),
    ]);

    const claimedMarkets = new Set(claims.map(c => c.marketAddress));

    let totalInvestment = BigInt(0);
    let totalReturn = BigInt(0);

    const positions = bets.map((bet) => {
        const m = bet.market;
        const amount = BigInt(bet.amount);
        totalInvestment += amount;

        const claimed = claimedMarkets.has(m.contractAddress);
        let estimatedReturn = BigInt(0);
        let status: 'active' | 'won' | 'lost' | 'expired' = 'active';

        if (m.resolved) {
            const won = (bet.side === 'YES' && m.reached) || (bet.side === 'NO' && !m.reached);
            if (won) {
                const winPool = bet.side === 'YES' ? BigInt(m.yesPool) : BigInt(m.noPool);
                const losePool = bet.side === 'YES' ? BigInt(m.noPool) : BigInt(m.yesPool);
                const total = winPool + losePool;
                estimatedReturn = winPool > 0n ? (amount * total) / winPool : amount;
                status = 'won';
            } else {
                status = 'lost';
            }
        } else if (new Date(m.deadline) < new Date()) {
            status = 'expired';
        } else {
            // Estimate return if current side wins
            const winPool = bet.side === 'YES' ? BigInt(m.yesPool) : BigInt(m.noPool);
            const losePool = bet.side === 'YES' ? BigInt(m.noPool) : BigInt(m.yesPool);
            const total = winPool + losePool;
            estimatedReturn = winPool > 0n ? (amount * total) / winPool : amount;
        }

        totalReturn += estimatedReturn;

        return {
            betId: bet.id,
            side: bet.side,
            amount: bet.amount,
            txHash: bet.txHash,
            chainId: bet.chainId,
            createdAt: bet.createdAt,
            claimed,
            status,
            estimatedReturn: estimatedReturn.toString(),
            market: m,
        };
    });

    const pnlWei = totalReturn - totalInvestment;

    const referralVolumeWei = referrals.reduce(
        (sum, r) => sum + BigInt(r.volumeGenerated || '0'),
        0n,
    );
    const uniqueReferees = new Set(referrals.map((r) => r.refereeId)).size;

    return res.status(200).json({
        address,
        totalBets: bets.length,
        totalInvestmentEth: (Number(totalInvestment) / 1e18).toFixed(6),
        totalReturnEth: (Number(totalReturn) / 1e18).toFixed(6),
        pnlEth: (Number(pnlWei) / 1e18).toFixed(6),
        pnlPercent: totalInvestment > 0n
            ? ((Number(pnlWei) / Number(totalInvestment)) * 100).toFixed(2)
            : '0.00',
        referralStats: {
            totalReferrals: referrals.length,
            uniqueReferees,
            totalVolumeEth: (Number(referralVolumeWei) / 1e18).toFixed(6),
        },
        positions,
    });
}

export default compose(
    withErrorHandler,
    withMethod('GET'),
    withAuth,
)(handler);
