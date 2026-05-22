/**
 * DailyChallenges — Card showing today's challenges with progress bars.
 */

import { motion } from 'framer-motion';
import { useChallenges, type Challenge } from '@/hooks/useChallenges';

interface DailyChallengesProps {
  className?: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4ade80',
  medium: '#f59e0b',
  hard: '#ef4444',
};

const DIFFICULTY_ICONS: Record<string, string> = {
  easy: '⭐',
  medium: '⭐⭐',
  hard: '⭐⭐⭐',
};

export function DailyChallenges({ className = '' }: DailyChallengesProps) {
  const {
    challenges,
    completedCount,
    totalCount,
  } = useChallenges();

  if (!challenges || challenges.length === 0) return null;

  const allComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">📋 Daily Challenges</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-[var(--text-muted)]">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Challenge List */}
      <div className="space-y-2">
        {challenges.map((challenge: Challenge, idx: number) => (
          <ChallengeRow key={challenge.id} challenge={challenge} index={idx} />
        ))}
      </div>

      {/* Bonus Section */}
      <div className="mt-3 pt-3 border-t border-white/10">
        {allComplete ? (
          <div className="text-center text-xs text-green-400/60">
            ✓ All challenges completed!
          </div>
        ) : (
          <div className="text-center text-xs text-[var(--text-muted)]">
            Complete all challenges for bonus XP
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeRow({ challenge, index }: { challenge: Challenge; index: number }) {
  const diffColor = DIFFICULTY_COLORS[(challenge as any).difficulty] ?? '#f59e0b';
  const progress = Math.min(1, challenge.progress / challenge.target);
  const isComplete = challenge.completed;

  return (
    <motion.div
      className={`p-3 rounded-lg border transition-colors ${
        isComplete
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="text-green-400">✓</span>
          ) : (
            <span className="text-xs text-amber-400">
              ⭐
            </span>
          )}
          <span className={`text-sm ${isComplete ? 'text-green-400 line-through' : 'text-white'}`}>
            {challenge.description}
          </span>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          +{challenge.xpReward} XP
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              backgroundColor: isComplete ? '#4ade80' : '#f59e0b',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)] font-mono min-w-[3rem] text-right">
          {challenge.progress}/{challenge.target}
        </span>
      </div>
    </motion.div>
  );
}
