/**
 * SeasonBanner — Displays current season info and countdown.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSeason } from '@/hooks/useSeason';

interface SeasonBannerProps {
  className?: string;
}

function computeTimeRemaining(endDate: number) {
  const now = Date.now();
  const diff = Math.max(0, endDate - now);
  const totalMs = endDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const startDate = 0; // We don't know the real duration to compute percent
  return { days, hours, minutes, totalMs };
}

export function SeasonBanner({ className = '' }: SeasonBannerProps) {
  const { season } = useSeason();

  const timeRemaining = useMemo(() => {
    if (!season?.endDate) return null;
    const end = typeof season.endDate === 'number' ? season.endDate : new Date(season.endDate).getTime();
    return computeTimeRemaining(end);
  }, [season]);

  if (!season) return null;

  const startMs = typeof season.startDate === 'number' ? season.startDate : new Date(season.startDate).getTime();
  const endMs = typeof season.endDate === 'number' ? season.endDate : new Date(season.endDate).getTime();
  const totalDuration = endMs - startMs;
  const elapsed = Date.now() - startMs;
  const percentComplete = totalDuration > 0 ? Math.min(100, Math.round((elapsed / totalDuration) * 100)) : 0;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden ${className}`}>
      {/* Season Header */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-white">🏆 {season.name}</h3>
            <p className="text-xs text-[var(--text-muted)]">Season {season.number}</p>
          </div>
          {timeRemaining && (
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)]">Ends in</div>
              <div className="text-sm font-mono text-white">
                {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
              </div>
            </div>
          )}
        </div>

        {/* Season progress bar */}
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${percentComplete}%` }}
            transition={{ duration: 1 }}
          />
        </div>
      </div>

      {/* Participant count */}
      {season.totalParticipants > 0 && (
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-sm text-[var(--text-muted)]">
            {season.totalParticipants.toLocaleString()} participants
          </span>
        </div>
      )}
    </div>
  );
}
