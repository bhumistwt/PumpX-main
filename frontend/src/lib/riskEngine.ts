/**
 * PumpX — Risk Engine
 *
 * Assesses order risk by comparing order price vs model-implied price.
 * Called before large order execution.
 * Integrates fraud detection for USER_EDGE_ABUSE flagging.
 */

import { prisma } from '../server/db';
import { mlClient } from './mlClient';
import { recordBet } from './fraudDetector';
import { marketImpliedProbability } from './marketEngine';
import { createLogger } from '../server/logger';

const log = createLogger('risk-engine');

// Thresholds (configurable via env)
const BIG_ORDER_WEI = BigInt(
    process.env.RISK_BIG_ORDER_WEI ?? String(100_000_000_000_000_000n) // 0.1 ETH
);
const MANIPULATION_DEVIATION = parseFloat(
    process.env.RISK_MANIPULATION_DEVIATION ?? '0.25'
);
const HIGH_DEVIATION_THRESHOLD = parseFloat(
    process.env.RISK_HIGH_DEVIATION_THRESHOLD ?? '0.15'
);

export interface RiskAssessment {
    isSafe: boolean;
    flags: string[];
    slippageMultiplier: number;  // 1.0 = no extra slippage
    modelProbability: number;
    marketImplied: number;
    deviation: number;
}

/**
 * Assess order risk before execution.
 *
 * @param marketAddress  - Contract address of the market
 * @param orderPrice     - Implied probability from the order (0–1)
 * @param betAmountWei   - Bet amount in wei as bigint
 * @param side           - 'YES' or 'NO'
 * @param userAddress    - Wallet address of the bettor (for fraud check)
 */
export async function assessOrderRisk(
    marketAddress: string,
    orderPrice: number,
    betAmountWei: bigint,
    side: 'YES' | 'NO',
    userAddress?: string
): Promise<RiskAssessment> {
    const flags: string[] = [];
    let slippageMultiplier = 1.0;

    try {
        // Fetch market from DB for model baseline and pool state
        const market = await prisma.market.findUnique({
            where: { contractAddress: marketAddress.toLowerCase() },
            select: {
                modelBaselineProbability: true,
                yesPool: true,
                noPool: true,
                stockTicker: true,
            },
        });

        if (!market) {
            flags.push('MARKET_NOT_FOUND');
            return { isSafe: false, flags, slippageMultiplier: 1.5, modelProbability: 0.5, marketImplied: 0.5, deviation: 0 };
        }

        // Get model probability (stored baseline or live)
        let modelProbability: number;
        let modelConfidence = 0;
        if (market.modelBaselineProbability !== null) {
            modelProbability = market.modelBaselineProbability;
        } else {
            const liveResult = await mlClient.predict({ symbol: market.stockTicker ?? 'UNKNOWN' });
            modelProbability = liveResult.probability;
            modelConfidence = liveResult.confidence;
            if (liveResult.risk_flags.some((f) => f.includes('MODEL_UNAVAILABLE'))) {
                flags.push('MODEL_UNAVAILABLE');
            }
        }

        // Market-implied probability
        const yesWei = BigInt(market.yesPool ?? '0');
        const noWei = BigInt(market.noPool ?? '0');
        const mktImplied = marketImpliedProbability(yesWei, noWei);

        // Deviation of order vs model
        // For YES bet: order implies probability = orderPrice
        // For NO bet:  order implies probability = 1 - orderPrice
        const orderImplied = side === 'YES' ? orderPrice : 1 - orderPrice;
        const deviation = Math.abs(orderImplied - modelProbability);

        // Flag HIGH_DEVIATION
        if (deviation > HIGH_DEVIATION_THRESHOLD) {
            flags.push(`HIGH_DEVIATION: order=${orderImplied.toFixed(3)} model=${modelProbability.toFixed(3)}`);
        }

        // MANIPULATION_RISK: extreme deviation + large order
        const isBigOrder = betAmountWei >= BIG_ORDER_WEI;
        if (deviation > MANIPULATION_DEVIATION && isBigOrder) {
            flags.push('MANIPULATION_RISK');
            slippageMultiplier = 1.3; // 30% extra slippage penalty
            log.warn(
                { marketAddress, orderImplied, modelProbability, deviation, betAmountWei: betAmountWei.toString() },
                'MANIPULATION_RISK detected'
            );
        }

        // ── Fraud check: USER_EDGE_ABUSE detection ──────────────────
        if (userAddress) {
            const fraudResult = recordBet(userAddress, marketAddress, modelConfidence);
            if (fraudResult.flagged) {
                flags.push(...fraudResult.flags);
                log.warn(
                    { userAddress, marketAddress, lowConfBets: fraudResult.lowConfBetCount },
                    'USER_EDGE_ABUSE integrated into risk assessment'
                );
            }
        }

        return {
            isSafe: !flags.includes('MANIPULATION_RISK') && !flags.some((f) => f.includes('USER_EDGE_ABUSE')),
            flags,
            slippageMultiplier,
            modelProbability,
            marketImplied: mktImplied,
            deviation,
        };
    } catch (err) {
        log.error({ err }, 'Risk assessment error');
        // Fail open with a warning flag — do not block the user
        return {
            isSafe: true,
            flags: ['RISK_ENGINE_ERROR'],
            slippageMultiplier: 1.0,
            modelProbability: 0.5,
            marketImplied: 0.5,
            deviation: 0,
        };
    }
}

