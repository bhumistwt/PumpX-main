/**
 * PumpX AI Layer — Reputation System
 *
 * Adapted from LeftCrypto's reputation engine for prediction market context:
 * - Market creator reputation
 * - Address trust scores
 * - Flag suspicious creators
 * - Upvote reliable predictors
 * - Win rate tracking
 *
 * Storage: In-memory with localStorage persistence (no external DB required)
 */

import type { ReputationData, ReputationFlag, TrustLevel } from './types';

// ── Constants ──────────────────────────────────────────

const STORAGE_KEY = 'pumpx-reputation';
const FLAGS_KEY = 'pumpx-flags';

const SCORE_WEIGHTS = {
  successfulTx: 5,        // +5 per successful tx
  marketCreated: 8,       // +8 per market created
  marketResolved: 10,     // +10 per market resolved (shows commitment)
  betPlaced: 2,           // +2 per bet placed
  win: 15,                // +15 per correct prediction
  upvote: 5,              // +5 per upvote from another user
  flag: -25,              // -25 per flag
} as const;

const TRUST_THRESHOLDS = {
  trusted: 70,
  neutral: 30,
  caution: 0,
} as const;

const FLAG_THRESHOLD = 3; // Flagged if >= 3 unique flags

// ── In-Memory Store ────────────────────────────────────

let reputationStore: Map<string, ReputationData> = new Map();
let flagStore: ReputationFlag[] = [];
let initialized = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  if (typeof window === 'undefined') return;

  try {
    const repData = localStorage.getItem(STORAGE_KEY);
    if (repData) {
      const parsed = JSON.parse(repData) as [string, ReputationData][];
      reputationStore = new Map(parsed);
    }
  } catch {}

  try {
    const flagData = localStorage.getItem(FLAGS_KEY);
    if (flagData) {
      flagStore = JSON.parse(flagData);
    }
  } catch {}
}

function persist() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(reputationStore.entries())));
    localStorage.setItem(FLAGS_KEY, JSON.stringify(flagStore));
  } catch {}
}

// ── Score Calculation ──────────────────────────────────

function calculateScore(data: ReputationData): number {
  let score =
    data.successfulTxCount * SCORE_WEIGHTS.successfulTx +
    data.marketsCreated * SCORE_WEIGHTS.marketCreated +
    data.marketsResolved * SCORE_WEIGHTS.marketResolved +
    data.upvotes * SCORE_WEIGHTS.upvote +
    data.flags * SCORE_WEIGHTS.flag;

  // Bonus for win rate
  if (data.winRate > 60) score += 15;
  else if (data.winRate > 40) score += 5;

  return Math.max(0, Math.min(100, score));
}

function getTrustLevel(score: number, flagCount: number): TrustLevel {
  if (flagCount >= FLAG_THRESHOLD) return 'flagged';
  if (score >= TRUST_THRESHOLDS.trusted) return 'trusted';
  if (score >= TRUST_THRESHOLDS.neutral) return 'neutral';
  return 'caution';
}

function ensureEntry(address: string): ReputationData {
  ensureInit();
  const key = address.toLowerCase();
  let entry = reputationStore.get(key);
  if (!entry) {
    entry = {
      address: key,
      score: 0,
      trustLevel: 'neutral',
      successfulTxCount: 0,
      marketsCreated: 0,
      marketsResolved: 0,
      totalBetVolume: 0,
      winRate: 0,
      upvotes: 0,
      flags: 0,
      lastActivity: Date.now(),
    };
    reputationStore.set(key, entry);
  }
  return entry;
}

function recalculate(entry: ReputationData): ReputationData {
  entry.score = calculateScore(entry);
  entry.trustLevel = getTrustLevel(entry.score, entry.flags);
  entry.lastActivity = Date.now();
  return entry;
}

// ── Public API ─────────────────────────────────────────

export function getReputation(address: string): ReputationData {
  const entry = ensureEntry(address);
  return recalculate({ ...entry });
}

export function recordMarketCreated(address: string): ReputationData {
  const entry = ensureEntry(address);
  entry.marketsCreated++;
  recalculate(entry);
  persist();
  return { ...entry };
}

export function recordMarketResolved(address: string): ReputationData {
  const entry = ensureEntry(address);
  entry.marketsResolved++;
  recalculate(entry);
  persist();
  return { ...entry };
}

export function recordBet(address: string, amountEth: number): ReputationData {
  const entry = ensureEntry(address);
  entry.successfulTxCount++;
  entry.totalBetVolume += amountEth;
  recalculate(entry);
  persist();
  return { ...entry };
}

export function recordWin(address: string): ReputationData {
  const entry = ensureEntry(address);
  // Simplified win rate: increment wins
  const totalBets = entry.successfulTxCount || 1;
  const currentWins = Math.round((entry.winRate / 100) * totalBets);
  entry.winRate = ((currentWins + 1) / (totalBets)) * 100;
  recalculate(entry);
  persist();
  return { ...entry };
}

export function upvoteAddress(target: string, voter: string): { success: boolean; data?: ReputationData; error?: string } {
  if (target.toLowerCase() === voter.toLowerCase()) {
    return { success: false, error: 'Cannot upvote yourself' };
  }

  const entry = ensureEntry(target);
  entry.upvotes++;
  recalculate(entry);
  persist();
  return { success: true, data: { ...entry } };
}

export function flagAddress(
  target: string,
  flagger: string,
  reason: string
): { success: boolean; data?: ReputationData; error?: string } {
  ensureInit();

  if (target.toLowerCase() === flagger.toLowerCase()) {
    return { success: false, error: 'Cannot flag yourself' };
  }

  // Check for duplicate flag from same flagger
  const exists = flagStore.some(
    f => f.targetAddress.toLowerCase() === target.toLowerCase() &&
         f.flaggerAddress.toLowerCase() === flagger.toLowerCase()
  );
  if (exists) {
    return { success: false, error: 'Already flagged this address' };
  }

  flagStore.push({
    targetAddress: target.toLowerCase(),
    flaggerAddress: flagger.toLowerCase(),
    reason,
    timestamp: Date.now(),
  });

  const entry = ensureEntry(target);
  entry.flags++;
  recalculate(entry);
  persist();
  return { success: true, data: { ...entry } };
}

export function getFlags(address: string): ReputationFlag[] {
  ensureInit();
  return flagStore.filter(f => f.targetAddress.toLowerCase() === address.toLowerCase());
}

export function getLeaderboard(limit = 20): ReputationData[] {
  ensureInit();
  return Array.from(reputationStore.values())
    .map(e => recalculate({ ...e }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getAllReputations(): ReputationData[] {
  ensureInit();
  return Array.from(reputationStore.values()).map(e => ({ ...e }));
}
