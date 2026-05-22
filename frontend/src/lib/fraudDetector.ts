/**
 * PumpX — Fraud Detector
 *
 * Detects USER_EDGE_ABUSE: users that systematically bet into
 * low-confidence model predictions (exploiting the model's uncertainty).
 *
 * Usage: call recordBet() after every bet is placed.
 */

import { createLogger } from '../server/logger';

const log = createLogger('fraud-detector');

const LOW_CONFIDENCE_THRESHOLD = parseFloat(
    process.env.FRAUD_LOW_CONF_THRESHOLD ?? '0.3'
);
const ABUSE_BET_COUNT = parseInt(
    process.env.FRAUD_ABUSE_BET_COUNT ?? '5'
);
const ABUSE_WINDOW_MS = parseInt(
    process.env.FRAUD_ABUSE_WINDOW_MS ?? String(24 * 60 * 60 * 1000) // 24 h
);

interface BetRecord {
    timestamp: number;
    confidence: number;
    marketAddress: string;
}

// In-memory rolling window per user (restarted on server restart)
// For production: back this with Redis
const _userBetWindows = new Map<string, BetRecord[]>();

export interface FraudCheckResult {
    flagged: boolean;
    flags: string[];
    lowConfBetCount: number;
    windowMs: number;
}

/** Evict expired bet records for all users. */
function evictExpired() {
    const cutoff = Date.now() - ABUSE_WINDOW_MS;
    for (const [user, bets] of _userBetWindows.entries()) {
        const fresh = bets.filter((b) => b.timestamp > cutoff);
        if (fresh.length === 0) {
            _userBetWindows.delete(user);
        } else {
            _userBetWindows.set(user, fresh);
        }
    }
}

/**
 * Record a bet and check for edge-abuse patterns.
 *
 * @param userAddress     - Wallet address of the bettor
 * @param marketAddress   - Market contract address
 * @param confidence      - Model confidence at bet time (0–1)
 * @returns               FraudCheckResult
 */
export function recordBet(
    userAddress: string,
    marketAddress: string,
    confidence: number
): FraudCheckResult {
    evictExpired();

    const user = userAddress.toLowerCase();
    const now = Date.now();
    const record: BetRecord = { timestamp: now, confidence, marketAddress };

    const existing = _userBetWindows.get(user) ?? [];
    existing.push(record);
    _userBetWindows.set(user, existing);

    const cutoff = now - ABUSE_WINDOW_MS;
    const recentBets = existing.filter((b) => b.timestamp > cutoff);
    const lowConfBets = recentBets.filter((b) => b.confidence < LOW_CONFIDENCE_THRESHOLD);

    const flags: string[] = [];
    if (lowConfBets.length >= ABUSE_BET_COUNT) {
        flags.push(
            `USER_EDGE_ABUSE: ${lowConfBets.length} low-confidence bets in ${Math.round(ABUSE_WINDOW_MS / 3_600_000)}h window`
        );
        log.warn(
            { userAddress: user, lowConfBets: lowConfBets.length, threshold: LOW_CONFIDENCE_THRESHOLD },
            'USER_EDGE_ABUSE flagged'
        );
    }

    return {
        flagged: flags.length > 0,
        flags,
        lowConfBetCount: lowConfBets.length,
        windowMs: ABUSE_WINDOW_MS,
    };
}

/** Get current abuse stats for a user (for admin display). */
export function getUserAbuseStats(userAddress: string): {
    recentBets: number;
    lowConfBets: number;
    isFlagged: boolean;
} {
    evictExpired();
    const user = userAddress.toLowerCase();
    const cutoff = Date.now() - ABUSE_WINDOW_MS;
    const recent = (_userBetWindows.get(user) ?? []).filter((b) => b.timestamp > cutoff);
    const lowConf = recent.filter((b) => b.confidence < LOW_CONFIDENCE_THRESHOLD);
    return {
        recentBets: recent.length,
        lowConfBets: lowConf.length,
        isFlagged: lowConf.length >= ABUSE_BET_COUNT,
    };
}
