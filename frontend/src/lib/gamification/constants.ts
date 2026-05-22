/**
 * PumpX Gamification — Constants & Configuration
 *
 * Central configuration for XP values, level thresholds,
 * badge definitions, challenge templates, and rate limits.
 */

import type {
  XPAction,
  LevelDefinition,
  LevelTier,
  BadgeDefinition,
  BadgeId,
  ChallengeType,
  ChallengeDifficulty,
  RateLimitConfig,
} from './types';

// ── XP Values per Action ───────────────────────────────

export const XP_VALUES: Record<XPAction, number> = {
  first_prediction: 100,
  correct_prediction: 50,
  wrong_prediction: 10,    // Participation reward
  daily_login: 15,
  market_created: 75,
  social_share: 20,
  ai_assistant_usage: 10,
  battle_won: 80,
  battle_participated: 15,
  challenge_completed: 0,  // Varies per challenge
  streak_milestone: 0,     // Varies per milestone
  squad_joined: 30,
  referral_signup: 50,
};

// ── Level Definitions ──────────────────────────────────

export const LEVEL_TIERS: Record<LevelTier, { minLevel: number; maxLevel: number }> = {
  Rookie:  { minLevel: 1, maxLevel: 10 },
  Trader:  { minLevel: 11, maxLevel: 25 },
  Analyst: { minLevel: 26, maxLevel: 45 },
  Oracle:  { minLevel: 46, maxLevel: 70 },
  Prophet: { minLevel: 71, maxLevel: 100 },
};

/**
 * XP required for each level. Uses exponential curve:
 * XP(n) = floor(100 * (1.15 ^ (n-1)))
 * Cumulative XP sums all previous levels.
 */
export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export function getCumulativeXP(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += getXPForLevel(i);
  }
  return total;
}

export function getLevelFromXP(totalXP: number): number {
  let level = 1;
  let cumulative = 0;
  while (level < 100) {
    cumulative += getXPForLevel(level);
    if (totalXP < cumulative) return level;
    level++;
  }
  return 100;
}

export function getTierFromLevel(level: number): LevelTier {
  if (level <= 10) return 'Rookie';
  if (level <= 25) return 'Trader';
  if (level <= 45) return 'Analyst';
  if (level <= 70) return 'Oracle';
  return 'Prophet';
}

export const MAX_LEVEL = 100;

export const LEVEL_DEFINITIONS: LevelDefinition[] = [
  {
    tier: 'Rookie',
    level: 1,
    minXP: 0,
    maxXP: getCumulativeXP(10),
    color: '#6b7280',     // Gray
    icon: '🌱',
    privileges: ['Basic market access', 'Daily challenges'],
  },
  {
    tier: 'Trader',
    level: 11,
    minXP: getCumulativeXP(10),
    maxXP: getCumulativeXP(25),
    color: '#3b82f6',     // Blue
    icon: '📊',
    privileges: ['Create markets', 'Join squads', 'PvP battles'],
  },
  {
    tier: 'Analyst',
    level: 26,
    minXP: getCumulativeXP(25),
    maxXP: getCumulativeXP(45),
    color: '#8b5cf6',     // Purple
    icon: '🔮',
    privileges: ['Advanced analytics', 'Squad creation', 'Higher battle stakes'],
  },
  {
    tier: 'Oracle',
    level: 46,
    minXP: getCumulativeXP(45),
    maxXP: getCumulativeXP(70),
    color: '#f59e0b',     // Amber
    icon: '⚡',
    privileges: ['Market moderation', 'Season rewards multiplier', 'Exclusive badges'],
  },
  {
    tier: 'Prophet',
    level: 71,
    minXP: getCumulativeXP(70),
    maxXP: getCumulativeXP(100),
    color: '#ef4444',     // Red/Gold
    icon: '👁️',
    privileges: ['All privileges', 'Prophet badge', 'Governance voting', 'Custom markets'],
  },
];

// ── Tier Colors (for UI) ───────────────────────────────

export const TIER_COLORS: Record<LevelTier, { bg: string; text: string; border: string; glow: string }> = {
  Rookie:  { bg: 'bg-gray-500/10',   text: 'text-gray-400',   border: 'border-gray-500/20',   glow: 'shadow-gray-500/20' },
  Trader:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   glow: 'shadow-blue-500/20' },
  Analyst: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', glow: 'shadow-purple-500/20' },
  Oracle:  { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20',  glow: 'shadow-amber-500/20' },
  Prophet: { bg: 'bg-red-500/10',    text: 'text-red-400',    border: 'border-red-500/20',    glow: 'shadow-red-500/20' },
};

export const RARITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Common:    { bg: 'bg-gray-400/10',   text: 'text-gray-300',   border: 'border-gray-400/20' },
  Rare:      { bg: 'bg-blue-400/10',   text: 'text-blue-400',   border: 'border-blue-400/20' },
  Epic:      { bg: 'bg-purple-400/10', text: 'text-purple-400', border: 'border-purple-400/20' },
  Legendary: { bg: 'bg-amber-400/10',  text: 'text-amber-300',  border: 'border-amber-400/30' },
};

// ── Badge Definitions ──────────────────────────────────

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Place your first prediction ever',
    rarity: 'Common',
    icon: '🎯',
    color: '#6b7280',
    condition: 'Place 1 prediction',
    xpReward: 50,
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Win 5 predictions in a row',
    rarity: 'Rare',
    icon: '🎯',
    color: '#3b82f6',
    condition: '5 consecutive wins',
    xpReward: 150,
  },
  {
    id: 'whale_caller',
    name: 'Whale Caller',
    description: 'Correctly predict a market with >1 ETH total pool',
    rarity: 'Rare',
    icon: '🐋',
    color: '#06b6d4',
    condition: 'Win on a >1 ETH market',
    xpReward: 200,
  },
  {
    id: 'contrarian',
    name: 'Contrarian',
    description: 'Win a bet where you were in the minority (<30% side)',
    rarity: 'Epic',
    icon: '🔄',
    color: '#8b5cf6',
    condition: 'Win as minority (<30%)',
    xpReward: 300,
  },
  {
    id: 'trendsetter',
    name: 'Trendsetter',
    description: 'Create a market that gets 10+ participants',
    rarity: 'Rare',
    icon: '🚀',
    color: '#10b981',
    condition: 'Create market with 10+ bettors',
    xpReward: 200,
  },
  {
    id: 'speed_prophet',
    name: 'Speed Prophet',
    description: 'Place a bet within 60 seconds of market creation',
    rarity: 'Common',
    icon: '⚡',
    color: '#f59e0b',
    condition: 'Bet within 60s of market creation',
    xpReward: 75,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Place 5 predictions between midnight and 5 AM',
    rarity: 'Common',
    icon: '🦉',
    color: '#6366f1',
    condition: '5 late-night predictions',
    xpReward: 100,
  },
  {
    id: 'streak_warrior',
    name: 'Streak Warrior',
    description: 'Maintain a 7-day prediction streak',
    rarity: 'Rare',
    icon: '🔥',
    color: '#ef4444',
    condition: '7-day streak',
    xpReward: 200,
  },
  {
    id: 'streak_legend',
    name: 'Streak Legend',
    description: 'Maintain a 30-day prediction streak',
    rarity: 'Legendary',
    icon: '💎',
    color: '#f59e0b',
    condition: '30-day streak',
    xpReward: 1000,
  },
  {
    id: 'market_maker',
    name: 'Market Maker',
    description: 'Create 10 markets',
    rarity: 'Epic',
    icon: '🏭',
    color: '#8b5cf6',
    condition: 'Create 10 markets',
    xpReward: 500,
  },
  {
    id: 'diamond_hands',
    name: 'Diamond Hands',
    description: 'Hold a position through a 50% odds swing without selling',
    rarity: 'Epic',
    icon: '💎',
    color: '#06b6d4',
    condition: 'Hold through 50% swing',
    xpReward: 300,
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Share 10 markets on social media',
    rarity: 'Common',
    icon: '🦋',
    color: '#ec4899',
    condition: 'Share 10 markets',
    xpReward: 100,
  },
  {
    id: 'ai_whisperer',
    name: 'AI Whisperer',
    description: 'Use the AI assistant 25 times',
    rarity: 'Rare',
    icon: '🤖',
    color: '#3b82f6',
    condition: '25 AI interactions',
    xpReward: 150,
  },
  {
    id: 'battle_master',
    name: 'Battle Master',
    description: 'Win 10 PvP battles',
    rarity: 'Epic',
    icon: '⚔️',
    color: '#ef4444',
    condition: 'Win 10 battles',
    xpReward: 500,
  },
  {
    id: 'squad_leader',
    name: 'Squad Leader',
    description: 'Lead a squad to top 3 in seasonal rankings',
    rarity: 'Legendary',
    icon: '👑',
    color: '#f59e0b',
    condition: 'Squad in top 3 seasonal',
    xpReward: 1000,
  },
  {
    id: 'season_champion',
    name: 'Season Champion',
    description: 'Finish #1 in a season',
    rarity: 'Legendary',
    icon: '🏆',
    color: '#f59e0b',
    condition: 'Rank #1 in any season',
    xpReward: 2000,
  },
  {
    id: 'oracle_vision',
    name: 'Oracle Vision',
    description: 'Achieve 80%+ win rate over 20+ predictions',
    rarity: 'Legendary',
    icon: '👁️',
    color: '#a855f7',
    condition: '80%+ win rate (20+ bets)',
    xpReward: 1500,
  },
  {
    id: 'degen_king',
    name: 'Degen King',
    description: 'Place 100 total predictions',
    rarity: 'Epic',
    icon: '👑',
    color: '#ef4444',
    condition: '100 total predictions',
    xpReward: 500,
  },
];

export const BADGE_MAP: Record<BadgeId, BadgeDefinition> = Object.fromEntries(
  BADGE_DEFINITIONS.map(b => [b.id, b])
) as Record<BadgeId, BadgeDefinition>;

// ── Streak Configuration ───────────────────────────────

export const STREAK_CONFIG = {
  maxShieldsPerSeason: 3,
  shieldDurationHours: 24,
  milestones: [3, 7, 14, 21, 30, 60, 90, 180, 365],
  milestoneXP: {
    3: 50,
    7: 100,
    14: 200,
    21: 350,
    30: 500,
    60: 1000,
    90: 2000,
    180: 5000,
    365: 15000,
  } as Record<number, number>,
  multipliers: {
    0: 1.0,     // No streak
    3: 1.1,     // 3+ days
    7: 1.25,    // 7+ days
    14: 1.5,    // 14+ days
    30: 1.75,   // 30+ days
    60: 2.0,    // 60+ days
  } as Record<number, number>,
};

export function getStreakMultiplier(streak: number): number {
  const thresholds = Object.keys(STREAK_CONFIG.multipliers)
    .map(Number)
    .sort((a, b) => b - a);
  for (const threshold of thresholds) {
    if (streak >= threshold) return STREAK_CONFIG.multipliers[threshold];
  }
  return 1.0;
}

// ── Battle Configuration ───────────────────────────────

export const BATTLE_CONFIG = {
  minStakeETH: 0.001,
  maxStakeETH: 10,
  challengeExpiryHours: 24,
  maxActiveBattles: 5,
  cooldownMinutes: 5,
};

// ── Season Configuration ───────────────────────────────

export const SEASON_CONFIG = {
  durationDays: 30,
  rewardTiers: [
    { rank: 1, percentage: 30, badge: 'season_champion' as BadgeId },
    { rank: 2, percentage: 20 },
    { rank: 3, percentage: 15 },
    { rank: 5, percentage: 10 },   // ranks 4-5
    { rank: 10, percentage: 10 },  // ranks 6-10
    { rank: 25, percentage: 10 },  // ranks 11-25
    { rank: 50, percentage: 5 },   // ranks 26-50
  ],
  minParticipantsForRewards: 5,
  xpResetPercentage: 0,  // Season XP resets fully; total XP never resets
};

// ── Daily Challenge Templates ──────────────────────────

export interface ChallengeTemplate {
  type: ChallengeType;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  target: number;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Easy
  { type: 'make_prediction', title: 'Market Scout', description: 'Place 1 prediction today', difficulty: 'easy', xpReward: 25, target: 1 },
  { type: 'use_ai', title: 'AI Curious', description: 'Ask the AI assistant a question', difficulty: 'easy', xpReward: 15, target: 1 },
  { type: 'social_share', title: 'Spread the Word', description: 'Share a market on social media', difficulty: 'easy', xpReward: 20, target: 1 },
  // Medium
  { type: 'make_prediction', title: 'Active Trader', description: 'Place 3 predictions today', difficulty: 'medium', xpReward: 60, target: 3 },
  { type: 'win_prediction', title: 'Winner Winner', description: 'Win a prediction', difficulty: 'medium', xpReward: 50, target: 1 },
  { type: 'create_market', title: 'Market Creator', description: 'Create a new market', difficulty: 'medium', xpReward: 50, target: 1 },
  { type: 'battle_opponent', title: 'Challenger', description: 'Participate in a PvP battle', difficulty: 'medium', xpReward: 40, target: 1 },
  // Hard
  { type: 'win_prediction', title: 'Hat Trick', description: 'Win 3 predictions today', difficulty: 'hard', xpReward: 150, target: 3 },
  { type: 'bet_on_multiple_markets', title: 'Diversifier', description: 'Bet on 5 different markets', difficulty: 'hard', xpReward: 100, target: 5 },
  { type: 'place_contrarian_bet', title: 'Bold Move', description: 'Bet on the minority side (<30%)', difficulty: 'hard', xpReward: 75, target: 1 },
  { type: 'achieve_win_streak', title: 'Unstoppable', description: 'Win 3 bets in a row', difficulty: 'hard', xpReward: 120, target: 3 },
];

export const DAILY_CHALLENGE_COUNT = 3; // 3 challenges per day
export const ALL_COMPLETE_BONUS_XP = 100; // Bonus for completing all 3

// ── Squad Configuration ────────────────────────────────

export const SQUAD_CONFIG = {
  maxMembers: 10,
  minNameLength: 3,
  maxNameLength: 20,
  tagLength: { min: 2, max: 5 },
  inviteExpiryHours: 48,
  maxPendingInvites: 10,
  creationMinLevel: 11,  // Must be Trader tier
  xpContributionRate: 0.1, // 10% of member XP goes to squad
};

// ── Rate Limiting ──────────────────────────────────────

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  xp_action: { maxActions: 100, windowMs: 3600000 },      // 100 XP actions per hour
  battle_create: { maxActions: 10, windowMs: 3600000 },    // 10 battles per hour
  social_share: { maxActions: 20, windowMs: 86400000 },    // 20 shares per day
  ai_usage: { maxActions: 50, windowMs: 3600000 },         // 50 AI queries per hour
};

// ── Abuse Prevention ───────────────────────────────────

export const ABUSE_CONFIG = {
  maxXPPerHour: 2000,
  maxXPPerDay: 10000,
  suspiciousWinRate: 95,    // Flag if > 95% win rate after 20+ bets
  minTimeBetweenBets: 5000, // 5 seconds
  maxBetsPerMinute: 10,
  selfBattlePrevention: true,
  sybilDetection: {
    maxAccountsPerIP: 5,
    flagThreshold: 3,
  },
};
