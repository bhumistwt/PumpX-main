/**
 * LevelBadge — Displays a user's level as a stylized badge.
 * Can be used inline in leaderboards, cards, etc.
 */

import { motion } from 'framer-motion';
import { LEVEL_TIERS, TIER_COLORS } from '@/lib/gamification';
import type { LevelTier } from '@/lib/gamification';

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showTier?: boolean;
  animate?: boolean;
  className?: string;
}

const SIZES = {
  sm: { container: 'w-6 h-6 text-[10px]', glow: 'blur-sm' },
  md: { container: 'w-9 h-9 text-sm', glow: 'blur-md' },
  lg: { container: 'w-14 h-14 text-xl', glow: 'blur-lg' },
};

export function LevelBadge({ level, size = 'md', showTier = false, animate = true, className = '' }: LevelBadgeProps) {
  const tierEntries = Object.entries(LEVEL_TIERS) as [LevelTier, { minLevel: number; maxLevel: number }][];
  const tierEntry = tierEntries.find(
    ([, range]) => level >= range.minLevel && level <= range.maxLevel
  );
  const tierName: LevelTier = tierEntry?.[0] ?? 'Rookie';
  const color = TIER_COLORS[tierName]?.text ?? '#60a5fa';
  const sizeConfig = SIZES[size];

  const Wrapper = animate ? motion.div : 'div' as any;
  const wrapperProps = animate ? { whileHover: { scale: 1.15 }, whileTap: { scale: 0.95 } } : {};

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Wrapper
        className={`relative flex items-center justify-center rounded-full border-2 font-bold ${sizeConfig.container}`}
        style={{ borderColor: color, color }}
        {...wrapperProps}
      >
        {level}
        <div
          className={`absolute inset-0 rounded-full opacity-20 ${sizeConfig.glow}`}
          style={{ backgroundColor: color }}
        />
      </Wrapper>
      {showTier && (
        <span className="text-xs font-medium" style={{ color }}>
          {tierName}
        </span>
      )}
    </div>
  );
}
