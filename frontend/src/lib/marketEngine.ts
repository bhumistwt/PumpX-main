/**
 * PumpX — Market Engine
 * Real-time odds, payout, and slippage calculations.
 * Uses pool-ratio pricing (no AMM needed for binary markets).
 */

/** Calculate YES and NO implied probabilities from pool balances */
export function calculateOdds(
    yesPool: bigint,
    noPool: bigint
): { yesOdds: number; noOdds: number; impliedYesPct: number; impliedNoPct: number } {
    const total = yesPool + noPool;
    if (total === 0n) {
        return { yesOdds: 1, noOdds: 1, impliedYesPct: 50, impliedNoPct: 50 };
    }

    const impliedYesPct = Number((yesPool * 10000n) / total) / 100;
    const impliedNoPct = Number((noPool * 10000n) / total) / 100;

    // Decimal odds = 1 / implied probability
    const yesOdds = impliedYesPct > 0 ? 100 / impliedYesPct : 0;
    const noOdds = impliedNoPct > 0 ? 100 / impliedNoPct : 0;

    return { yesOdds, noOdds, impliedYesPct, impliedNoPct };
}

/** Calculate expected payout for a winning bet (pro-rata pool model) */
export function calculatePayout(
    userDeposit: bigint,
    userPool: bigint,    // total in winning side
    opposingPool: bigint // total in losing side
): bigint {
    if (userPool === 0n) return 0n;
    if (opposingPool === 0n) return userDeposit; // Refund if no opposing bets
    return (userDeposit * (userPool + opposingPool)) / userPool;
}

/** Estimate price impact / slippage for a new bet */
export function calculateSlippage(
    betAmount: bigint,
    currentPool: bigint
): number {
    if (currentPool === 0n) return 0;
    return Number((betAmount * 10000n) / (currentPool + betAmount)) / 100;
}

/** Calculate ROI percentage for a user position */
export function calculateROI(invested: bigint, claimed: bigint): number {
    if (invested === 0n) return 0;
    return Number(((claimed - invested) * 10000n) / invested) / 100;
}

/** Format wei to ETH string with n decimal places */
export function formatEth(wei: bigint, decimals = 4): string {
    const eth = Number(wei) / 1e18;
    return eth.toFixed(decimals);
}

/** Parse ETH string to wei bigint */
export function parseEth(eth: string): bigint {
    const [whole, frac = ''] = eth.split('.');
    const fracPadded = (frac + '000000000000000000').slice(0, 18);
    return BigInt(whole) * BigInt('1000000000000000000') + BigInt(fracPadded);
}

/** Aggregate PumpScore from DB markets (0-100 index) */
export function aggregatePumpScore(
    markets: Array<{ yesPool: string; noPool: string; resolved: boolean }>
): number {
    const active = markets.filter((m) => !m.resolved);
    if (active.length === 0) return 50;

    let totalVolume = 0n;
    let weightedYes = 0n;

    for (const m of active) {
        const yes = BigInt(m.yesPool);
        const no = BigInt(m.noPool);
        const vol = yes + no;
        totalVolume += vol;
        weightedYes += yes * vol;
    }

    if (totalVolume === 0n) return 50;

    // weightedYes is in wei^2 units — divide twice
    const score = Number((weightedYes * 100n) / totalVolume / totalVolume);
    return Math.round(Math.max(0, Math.min(100, score)));
}

// ── ML-driven price anchoring ────────────────────────────────────────────────

/**
 * Anchor fair price from model probability.
 * fair_price = probability * 100 (cents on the dollar).
 */
export function anchorFairPrice(probability: number): number {
    const clipped = Math.max(0.01, Math.min(0.99, probability));
    return Math.round(clipped * 100);
}

/**
 * Compute blended probability between model and market.
 * default: 40% model + 60% market (configurable).
 */
export function computeBlendedProbability(
    modelProb: number,
    marketImplied: number,
    modelWeight = 0.4
): number {
    const w = Math.max(0, Math.min(1, modelWeight));
    const blended = w * modelProb + (1 - w) * marketImplied;
    return Math.max(0.01, Math.min(0.99, blended));
}

/** Compute market-implied probability from pool balances */
export function marketImpliedProbability(
    yesPool: bigint,
    noPool: bigint
): number {
    const total = yesPool + noPool;
    if (total === 0n) return 0.5;
    return Number((yesPool * 10_000n) / total) / 10_000;
}

