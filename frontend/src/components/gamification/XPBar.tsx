/**
 * XPBar — Animated XP progress bar with level badge.
 * Shows current level, XP progress, tier, and animated fill.
 */

import { motion } from 'framer-motion';
import { useXP } from '@/hooks/useXP';
import { getTierFromLevel, MAX_LEVEL } from '@/lib/gamification';

const TIER_HEX_COLORS: Record<string, string> = {
  Rookie: '#6b7280',
  Trader: '#3b82f6',
  Analyst: '#8b5cf6',
  Oracle: '#f59e0b',
  Prophet: '#ef4444',
};

interface XPBarProps {
  /** Compact mode for navbar */
  compact?: boolean;
  /** Show total XP */
  showRank?: boolean;
  className?: string;
}

export function XPBar({ compact = false, showRank = false, className = '' }: XPBarProps) {
  const { currentXP, level, nextThreshold, progressPercent, isLoading } = useXP();

  if (level === 0 && currentXP === 0) return null;

  const tier = getTierFromLevel(level);
  const tierColor = TIER_HEX_COLORS[tier] ?? '#6b7280';
  const tierLabel = tier;
  const isMaxLevel = level >= MAX_LEVEL;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2"
          style={{ borderColor: tierColor, color: tierColor }}
        >
          {level}
        </div>
        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: tierColor }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {/* Level Circle */}
          <motion.div
            className="relative flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg"
            style={{ borderColor: tierColor, color: tierColor }}
            whileHover={{ scale: 1.1 }}
          >
            {level}
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-full opacity-20 blur-md"
              style={{ backgroundColor: tierColor }}
            />
          </motion.div>

          <div>
            <div className="text-sm font-semibold text-white">Level {level}</div>
            <div className="text-xs" style={{ color: tierColor }}>
              {tierLabel}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-mono text-white">
            {currentXP.toLocaleString()} XP
          </div>
          {!isMaxLevel && (
            <div className="text-xs text-[var(--text-muted)]">
              {currentXP.toLocaleString()} / {nextThreshold.toLocaleString()}
            </div>
          )}
          {isMaxLevel && (
            <div className="text-xs" style={{ color: tierColor }}>
              MAX LEVEL
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative w-full h-3 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: tierColor }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        {/* Shine effect */}
        <motion.div
          className="absolute inset-y-0 left-0 w-full rounded-full opacity-30"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${tierColor}40 50%, transparent 100%)`,
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </div>

      {showRank && currentXP > 0 && (
        <div className="mt-2 text-xs text-[var(--text-muted)] flex justify-between">
          <span>Total XP: {currentXP.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
