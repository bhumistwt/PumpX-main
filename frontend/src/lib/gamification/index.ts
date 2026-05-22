/**
 * PumpX Gamification — Barrel Export (Production)
 *
 * Re-exports ONLY types and constants for use by UI components.
 * All runtime logic now lives server-side (API routes + PostgreSQL).
 * The old localStorage engines are deprecated and should NOT be imported.
 */

// ── Types ──────────────────────────────────────────────
export type {
  XPAction,
  LevelTier,
  XPTransaction,
  UserXPProfile,
  LevelDefinition,
  StreakData,
  StreakMilestone,
  BadgeRarity,
  BadgeId,
  BadgeDefinition,
  UserBadge,
  BadgeUnlockEvent,
  Battle,
  BattleStatus,
  BattleStats,
  Season,
  SeasonRanking,
  SeasonArchive,
  DailyChallenge,
  DailyChallengeSet,
  ChallengeType,
  ChallengeDifficulty,
  Squad,
  SquadMember,
  SquadInvite,
  GamificationEvent,
  GamificationEventType,
  GamificationNotification,
  NotificationType,
  AbuseFlag,
  RateLimitConfig,
} from './types';

// ── Constants & Pure Utilities ─────────────────────────
export {
  XP_VALUES,
  LEVEL_DEFINITIONS,
  MAX_LEVEL,
  LEVEL_TIERS,
  TIER_COLORS,
  RARITY_COLORS,
  BADGE_MAP,
  BADGE_DEFINITIONS,
  STREAK_CONFIG,
  BATTLE_CONFIG,
  SEASON_CONFIG,
  CHALLENGE_TEMPLATES,
  SQUAD_CONFIG,
  RATE_LIMITS,
  ABUSE_CONFIG,
  DAILY_CHALLENGE_COUNT,
  ALL_COMPLETE_BONUS_XP,
  getXPForLevel,
  getCumulativeXP,
  getLevelFromXP,
  getTierFromLevel,
  getStreakMultiplier,
} from './constants';
export type { ChallengeTemplate } from './constants';
