/**
 * StreakCounter — Displays the user's daily streak with fire animation.
 */

import { motion } from 'framer-motion';
import { useStreak } from '@/hooks/useStreak';

interface StreakCounterProps {
  compact?: boolean;
  className?: string;
}

export function StreakCounter({ compact = false, className = '' }: StreakCounterProps) {
  const { currentStreak, longestStreak, isCheckedInToday, checkIn, isLoading } = useStreak();

  const isActive = currentStreak > 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className={`text-sm ${isActive ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
          🔥
        </span>
        <span className={`text-xs font-mono ${isActive ? 'text-orange-400' : 'text-[var(--text-muted)]'}`}>
          {currentStreak}
        </span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Daily Streak</h3>
        {currentStreak >= 3 && (
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
            🔥 On Fire
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Streak Fire */}
        <motion.div
          className="relative flex items-center justify-center"
          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="text-4xl">{isActive ? '🔥' : '❄️'}</span>
        </motion.div>

        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{currentStreak}</span>
            <span className="text-sm text-[var(--text-muted)]">days</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)]">
            <span>Best: {longestStreak} days</span>
            {!isCheckedInToday && (
              <button
                onClick={() => checkIn()}
                disabled={isLoading}
                className="ml-auto px-2 py-0.5 rounded border border-white/20 hover:border-orange-500/50 hover:bg-orange-500/10 transition-colors text-orange-400 disabled:opacity-50"
              >
                ✅ Check In
              </button>
            )}
            {isCheckedInToday && (
              <span className="ml-auto text-green-400">✓ Checked in today</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
