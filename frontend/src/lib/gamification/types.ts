/**
 * PumpX Gamification — Type Definitions
 *
 * Complete type system for XP, levels, badges, streaks,
 * battles, seasons, squads, and daily challenges.
 */

// ── XP & Level Types ───────────────────────────────────

export type XPAction =
  | 'first_prediction'
  | 'correct_prediction'
  | 'wrong_prediction'
  | 'daily_login'
  | 'market_created'
  | 'social_share'
  | 'ai_assistant_usage'
  | 'battle_won'
  | 'battle_participated'
  | 'challenge_completed'
  | 'streak_milestone'
  | 'squad_joined'
  | 'referral_signup';

export type LevelTier = 'Rookie' | 'Trader' | 'Analyst' | 'Oracle' | 'Prophet';

export interface LevelDefinition {
  tier: LevelTier;
  level: number;
  minXP: number;
  maxXP: number;
  color: string;
  icon: string;
  privileges: string[];
}

export interface XPTransaction {
  id: string;
  address: string;
  action: XPAction;
  amount: number;           // Base XP
  multiplier: number;       // Streak/season multiplier
  finalAmount: number;      // amount * multiplier
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface UserXPProfile {
  address: string;
  totalXP: number;
  level: number;
  tier: LevelTier;
  xpToNextLevel: number;
  currentLevelXP: number;   // XP within current level
  levelProgress: number;    // 0-100%
  xpHistory: XPTransaction[];
  createdAt: number;
  updatedAt: number;
}

// ── Streak Types ───────────────────────────────────────

export interface StreakData {
  address: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string; // YYYY-MM-DD in UTC
  streakShieldActive: boolean;
  shieldExpiry: number | null; // timestamp
  shieldsUsedThisSeason: number;
  maxShieldsPerSeason: number;
  multiplier: number;
  streakHistory: StreakMilestone[];
}

export interface StreakMilestone {
  streak: number;
  achievedAt: number;
  bonusXP: number;
}

// ── Badge Types ────────────────────────────────────────

export type BadgeRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export type BadgeId =
  | 'first_blood'
  | 'sharpshooter'
  | 'whale_caller'
  | 'contrarian'
  | 'trendsetter'
  | 'speed_prophet'
  | 'night_owl'
  | 'streak_warrior'
  | 'streak_legend'
  | 'market_maker'
  | 'diamond_hands'
  | 'social_butterfly'
  | 'ai_whisperer'
  | 'battle_master'
  | 'squad_leader'
  | 'season_champion'
  | 'oracle_vision'
  | 'degen_king';

export interface BadgeDefinition {
  id: BadgeId;
  name: string;
  description: string;
  rarity: BadgeRarity;
  icon: string;
  color: string;
  condition: string;       // Human-readable condition
  xpReward: number;
}

export interface UserBadge {
  badgeId: BadgeId;
  unlockedAt: number;
  seen: boolean;           // Has user dismissed the notification
}

export interface BadgeUnlockEvent {
  badge: BadgeDefinition;
  userBadge: UserBadge;
}

// ── Battle (PvP) Types ─────────────────────────────────

export type BattleStatus =
  | 'pending'        // Challenge sent, awaiting response
  | 'accepted'       // Both players in, awaiting market resolution
  | 'rejected'       // Challenged player rejected
  | 'active'         // Battle in progress
  | 'settled'        // Battle resolved, winner determined
  | 'expired'        // Challenge timed out
  | 'cancelled';     // Challenger cancelled before acceptance

export interface Battle {
  id: string;
  challengerAddress: string;
  opponentAddress: string;
  marketAddress: string;
  marketQuestion: string;
  challengerSide: 'YES' | 'NO';
  opponentSide: 'YES' | 'NO';
  stakeAmount: number;     // ETH
  status: BattleStatus;
  winnerAddress?: string;
  createdAt: number;
  acceptedAt?: number;
  settledAt?: number;
  expiresAt: number;       // Challenge expiry
}

export interface BattleStats {
  address: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalStaked: number;
  totalWon: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

// ── Season Types ───────────────────────────────────────

export interface Season {
  id: string;
  name: string;
  number: number;
  startDate: number;       // timestamp
  endDate: number;         // timestamp
  isActive: boolean;
  rewardPool: number;
  totalParticipants: number;
}

export interface SeasonRanking {
  address: string;
  seasonId: string;
  rank: number;
  seasonXP: number;
  predictions: number;
  wins: number;
  winRate: number;
  tier: LevelTier;
  rewardEarned?: number;
}

export interface SeasonArchive {
  season: Season;
  topPlayers: SeasonRanking[];
  userRanking?: SeasonRanking;
}

// ── Daily Challenge Types ──────────────────────────────

export type ChallengeType =
  | 'make_prediction'
  | 'win_prediction'
  | 'create_market'
  | 'use_ai'
  | 'place_contrarian_bet'
  | 'bet_on_multiple_markets'
  | 'achieve_win_streak'
  | 'social_share'
  | 'battle_opponent';

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface DailyChallenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  target: number;          // e.g., "make 3 predictions" → target=3
  progress: number;
  completed: boolean;
  expiresAt: number;       // Midnight UTC
}

export interface DailyChallengeSet {
  date: string;            // YYYY-MM-DD
  challenges: DailyChallenge[];
  allCompleted: boolean;
  bonusXP: number;         // Bonus for completing all
  bonusClaimed: boolean;
}

// ── Squad Types ────────────────────────────────────────

export interface Squad {
  id: string;
  name: string;
  tag: string;             // 3-5 char tag, e.g., "PUMP"
  leaderAddress: string;
  members: SquadMember[];
  maxMembers: number;
  totalXP: number;
  seasonXP: number;
  inviteCode: string;
  createdAt: number;
  isPublic: boolean;
}

export interface SquadMember {
  address: string;
  role: 'leader' | 'officer' | 'member';
  joinedAt: number;
  contributedXP: number;
  seasonContributedXP: number;
}

export interface SquadInvite {
  id: string;
  squadId: string;
  inviterAddress: string;
  inviteeAddress: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
}

// ── Event Bus Types ────────────────────────────────────

export type GamificationEventType =
  | 'bet_placed'
  | 'bet_won'
  | 'bet_lost'
  | 'market_created'
  | 'market_resolved'
  | 'daily_login'
  | 'ai_used'
  | 'social_shared'
  | 'battle_created'
  | 'battle_accepted'
  | 'battle_settled'
  | 'challenge_progress'
  | 'challenge_completed'
  | 'squad_joined'
  | 'squad_xp_contributed'
  | 'season_ended'
  | 'badge_unlocked'
  | 'level_up'
  | 'streak_updated'
  | 'xp_gained';

export interface GamificationEvent {
  type: GamificationEventType;
  address: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export type GamificationEventHandler = (event: GamificationEvent) => void;

// ── Notification Types ─────────────────────────────────

export type NotificationType =
  | 'xp_gain'
  | 'level_up'
  | 'badge_unlock'
  | 'streak_milestone'
  | 'battle_challenge'
  | 'challenge_complete'
  | 'season_reward';

export interface GamificationNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
  read: boolean;
}

// ── Abuse Prevention Types ─────────────────────────────

export interface RateLimitConfig {
  maxActions: number;
  windowMs: number;
}

export interface AbuseFlag {
  address: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  auto: boolean;
}
