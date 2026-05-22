/**
 * PumpX — Zod Validation Schemas
 *
 * Strict input validation for all API endpoints.
 * Every mutation route must validate through these schemas.
 */

import { z } from 'zod';

// ── Primitives ───────────────────────────────────────────

export const ethereumAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform(v => v.toLowerCase());

export const txHash = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

export const positiveInt = z.number().int().positive();

export const weiString = z.string().regex(/^\d+$/, 'Must be a non-negative integer string');

export const chainId = z.number().int().refine(
  v => [8453, 84532].includes(v),
  'Unsupported chain ID'
);

// ── Auth Schemas ─────────────────────────────────────────

export const siweVerifySchema = z.object({
  message: z.string().min(1, 'SIWE message required'),
  signature: z.string().min(1, 'Signature required'),
});

// ── Market Schemas ───────────────────────────────────────

export const createMarketSchema = z.object({
  contractAddress: ethereumAddress,
  chainId: chainId,
  tokenAddress: ethereumAddress,
  question: z.string().min(10, 'Question must be at least 10 characters').max(500),
  threshold: weiString,
  deadline: z.string().datetime(),
  initialSupply: weiString,
  txHash: txHash,
  blockNumber: positiveInt,
  stockTicker: z.string().max(10).optional(),
});

export const marketQuerySchema = z.object({
  chainId: z.coerce.number().int().optional(),
  status: z.enum(['all', 'active', 'resolved']).default('all'),
  creator: ethereumAddress.optional(),
  ticker: z.string().max(10).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['newest', 'deadline', 'volume', 'bets']).default('newest'),
});

// ── Bet Schemas ──────────────────────────────────────────

export const recordBetSchema = z.object({
  marketAddress: ethereumAddress,
  side: z.enum(['YES', 'NO']),
  amount: weiString,
  txHash: txHash,
  blockNumber: positiveInt,
  chainId: chainId,
});

// ── Gamification Schemas ─────────────────────────────────

export const awardXPSchema = z.object({
  reason: z.string().max(100),
  amount: z.number().int().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
});

export const streakCheckInSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// ── Squad Schemas ────────────────────────────────────────

export const createSquadSchema = z.object({
  name: z.string().min(3, 'Squad name must be at least 3 characters').max(50),
  tag: z.string().min(2).max(5).regex(/^[A-Z0-9]+$/, 'Tag must be uppercase alphanumeric'),
});

export const joinSquadSchema = z.object({
  inviteCode: z.string().length(12, 'Invite code must be 12 characters'),
});

// ── Battle Schemas ───────────────────────────────────────

export const createBattleSchema = z.object({
  marketAddress: ethereumAddress,
  side: z.enum(['YES', 'NO']),
  stakeXP: z.number().int().min(10).max(1000),
  expiresInHours: z.number().int().min(1).max(168), // max 7 days
});

export const acceptBattleSchema = z.object({
  battleId: z.string().min(1),
});

// ── Reputation Schemas ───────────────────────────────────

export const reputationActionSchema = z.object({
  targetAddress: ethereumAddress,
  type: z.enum(['UPVOTE', 'FLAG']),
  reason: z.string().max(200).optional(),
});

// ── Challenge Schemas ────────────────────────────────────

export const updateChallengeSchema = z.object({
  challengeId: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  progress: z.number().int().min(0),
});

// ── Leaderboard Schemas ──────────────────────────────────

export const leaderboardQuerySchema = z.object({
  type: z.enum(['volume', 'pnl', 'winRate', 'xp', 'reputation']).default('volume'),
  chainId: z.coerce.number().int().optional(),
  seasonId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Types ────────────────────────────────────────────────

export type SiweVerifyInput = z.infer<typeof siweVerifySchema>;
export type CreateMarketInput = z.infer<typeof createMarketSchema>;
export type MarketQueryInput = z.infer<typeof marketQuerySchema>;
export type RecordBetInput = z.infer<typeof recordBetSchema>;
export type AwardXPInput = z.infer<typeof awardXPSchema>;
export type CreateSquadInput = z.infer<typeof createSquadSchema>;
export type JoinSquadInput = z.infer<typeof joinSquadSchema>;
export type CreateBattleInput = z.infer<typeof createBattleSchema>;
export type ReputationActionInput = z.infer<typeof reputationActionSchema>;
export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
