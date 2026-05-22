/**
 * GamificationDashboard — Full gamification overview page component.
 * Uses individual server-backed hooks (PostgreSQL) instead of localStorage.
 */

import { motion } from 'framer-motion';
import { useAccount } from 'wagmi';
import { XPBar } from './XPBar';
import { StreakCounter } from './StreakCounter';
import { BadgeShowcase } from './BadgeShowcase';
import { DailyChallenges } from './DailyChallenges';
import { SeasonBanner } from './SeasonBanner';
import { BattleCard, BattleStatsCard } from './BattleCard';
import { SquadPanel } from './SquadPanel';
import { useBattles } from '@/hooks/useBattles';

interface GamificationDashboardProps {
  className?: string;
}

export function GamificationDashboard({ className = '' }: GamificationDashboardProps) {
  const { address, isConnected } = useAccount();
  const { activeBattles, completedBattles, isLoading: battlesLoading } = useBattles();

  if (!isConnected || !address) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="text-center">
          <span className="text-4xl mb-3 block">🎮</span>
          <p className="text-sm text-[var(--text-muted)]">Connect wallet to view gamification</p>
        </div>
      </div>
    );
  }

  const battleStats = {
    totalBattles: activeBattles.length + completedBattles.length,
    wins: completedBattles.filter((b: any) => b.winnerAddress?.toLowerCase() === address.toLowerCase()).length,
    losses: completedBattles.filter((b: any) => b.winnerAddress && b.winnerAddress.toLowerCase() !== address.toLowerCase()).length,
    draws: 0,
    winRate: 0,
    totalStaked: 0,
    totalWon: 0,
    currentWinStreak: 0,
    bestWinStreak: 0,
    address,
  };
  if (battleStats.totalBattles > 0) {
    battleStats.winRate = battleStats.wins / battleStats.totalBattles;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Row 1: XP + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <XPBar showRank />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <StreakCounter />
        </motion.div>
      </div>

      {/* Row 2: Season + Challenges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SeasonBanner />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <DailyChallenges />
        </motion.div>
      </div>

      {/* Row 3: Battles */}
      {(activeBattles.length > 0 || completedBattles.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BattleStatsCard stats={battleStats} />
            <div className="space-y-2">
              {activeBattles.slice(0, 3).map((battle: any) => (
                <BattleCard
                  key={battle.id}
                  battle={battle}
                  currentAddress={address}
                  onAccept={() => {}}
                  onReject={() => {}}
                  onCancel={() => {}}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Row 4: Badges */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <BadgeShowcase showFilters />
      </motion.div>

      {/* Row 5: Squad */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <SquadPanel />
      </motion.div>
    </div>
  );
}
