/**
 * GET /api/markets/[address]/probability
 * Returns the ML-predicted probability for a specific market.
 * Public endpoint — exposes only safe fields.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../server/db';
import { mlClient } from '../../../../lib/mlClient';
import { compose, withErrorHandler, withMethod } from '../../../../server/middleware';
import type { AuthenticatedRequest } from '../../../../server/middleware';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    const { address } = req.query;

    if (!address || typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Invalid market address' });
    }

    const market = await prisma.market.findUnique({
        where: { contractAddress: address.toLowerCase() },
        select: {
            contractAddress: true,
            question: true,
            stockTicker: true,
            resolved: true,
            yesPool: true,
            noPool: true,
            modelBaselineProbability: true,
            modelConfidence: true,
            modelSignal: true,
            modelRiskFlags: true,
        },
    });

    if (!market) {
        return res.status(404).json({ error: 'Market not found' });
    }

    // Compute market-implied probability from pool balances
    const yesWei = BigInt(market.yesPool ?? '0');
    const noWei = BigInt(market.noPool ?? '0');
    const total = yesWei + noWei;
    const marketImplied = total > 0n
        ? Number((yesWei * 10_000n) / total) / 10_000
        : 0.5;

    // Use stored baseline if available, otherwise live-predict
    let probability = market.modelBaselineProbability ?? 0.5;
    let confidence = market.modelConfidence ?? 0.0;
    let signal = market.modelSignal ?? 'NEUTRAL';
    let risk_flags: string[] = market.modelRiskFlags ?? [];
    let isLive = false;

    if (market.modelBaselineProbability === null) {
        // No stored baseline — ask the model now (if ticker is known)
        const liveResult = await mlClient.predict({
            symbol: market.stockTicker ?? 'UNKNOWN',
            market: 'US',
        });
        probability = liveResult.probability;
        confidence = liveResult.confidence;
        signal = liveResult.signal;
        risk_flags = liveResult.risk_flags;
        isLive = true;
    }

    // Blended pricing
    const blended = mlClient.blend(probability, marketImplied);

    return res.status(200).json({
        marketAddress: market.contractAddress,
        model: {
            probability,
            confidence,
            signal,
            risk_flags,
            fair_price: Math.round(probability * 100),
            isLive,
        },
        marketImplied: {
            probability: marketImplied,
            fair_price: Math.round(marketImplied * 100),
        },
        blended: {
            probability: blended,
            fair_price: Math.round(blended * 100),
            model_weight: mlClient.blendWeight,
            market_weight: 1 - mlClient.blendWeight,
        },
    });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
