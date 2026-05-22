/**
 * BattleCard — Displays a PvP battle challenge.
 */

import { motion } from 'framer-motion';
import type { Battle, BattleStatus } from '@/lib/gamification';
import { LevelBadge } from './LevelBadge';

interface BattleCardProps {
  battle: Battle;
  currentAddress: string;
  onAccept?: (battleId: string) => void;
  onReject?: (battleId: string) => void;
  onCancel?: (battleId: string) => void;
  className?: string;
}

const STATUS_STYLES: Record<BattleStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Pending' },
  accepted: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Accepted' },
  active: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Active' },
  settled: { bg: 'bg-green-500/10', text: 'text-green-400', label: 'Settled' },
  expired: { bg: 'bg-gray-500/10', text: 'text-gray-400', label: 'Expired' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Cancelled' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Rejected' },
};

export function BattleCard({ battle, currentAddress, onAccept, onReject, onCancel, className = '' }: BattleCardProps) {
  const style = STATUS_STYLES[battle.status];
  const isChallenger = battle.challengerAddress === currentAddress;
  const isOpponent = battle.opponentAddress === currentAddress;
  const canAccept = battle.status === 'pending' && isOpponent;
  const canCancel = battle.status === 'pending' && isChallenger;

  return (
    <motion.div
      className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚔️</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
            {style.label}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          {battle.stakeAmount} ETH stake
        </span>
      </div>

      {/* Versus Layout */}
      <div className="flex items-center gap-3">
        {/* Challenger */}
        <div className="flex-1 text-center">
          <div className="text-xs text-[var(--text-muted)] mb-1">
            {isChallenger ? 'You' : 'Challenger'}
          </div>
          <div className="text-sm font-mono text-white">
            {battle.challengerAddress.slice(0, 6)}…{battle.challengerAddress.slice(-4)}
          </div>
          <span className={`text-xs mt-1 inline-block ${
            battle.challengerSide === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {battle.challengerSide}
          </span>
        </div>

        {/* VS */}
        <div className="flex-shrink-0">
          <motion.span
            className="text-lg font-bold text-white/30"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            VS
          </motion.span>
        </div>

        {/* Opponent */}
        <div className="flex-1 text-center">
          <div className="text-xs text-[var(--text-muted)] mb-1">
            {isOpponent ? 'You' : 'Opponent'}
          </div>
          <div className="text-sm font-mono text-white">
            {battle.opponentAddress.slice(0, 6)}…{battle.opponentAddress.slice(-4)}
          </div>
          <span className={`text-xs mt-1 inline-block ${
            battle.opponentSide === 'YES' ? 'text-green-400' : 'text-red-400'
          }`}>
            {battle.opponentSide}
          </span>
        </div>
      </div>

      {/* Winner display for settled battles */}
      {battle.status === 'settled' && battle.winnerAddress && (
        <div className="mt-3 pt-3 border-t border-white/5 text-center">
          <span className="text-yellow-400 text-sm font-semibold">
            🏆 {battle.winnerAddress === currentAddress ? 'You Won!' : `Winner: ${battle.winnerAddress.slice(0, 6)}…`}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {(canAccept || canCancel) && (
        <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
          {canAccept && (
            <>
              <motion.button
                onClick={() => onAccept?.(battle.id)}
                className="flex-1 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                Accept
              </motion.button>
              <motion.button
                onClick={() => onReject?.(battle.id)}
                className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors"
                whileTap={{ scale: 0.95 }}
              >
                Reject
              </motion.button>
            </>
          )}
          {canCancel && (
            <motion.button
              onClick={() => onCancel?.(battle.id)}
              className="flex-1 py-1.5 rounded-lg bg-white/10 text-[var(--text-muted)] text-sm hover:bg-white/15 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              Cancel
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Battle Stats Summary ──────────────────────────────

interface BattleStatsCardProps {
  stats: {
    totalBattles: number;
    wins: number;
    losses: number;
    draws: number;
    currentWinStreak: number;
    bestWinStreak: number;
    totalStaked: number;
    totalWon: number;
  } | null;
  className?: string;
}

export function BattleStatsCard({ stats, className = '' }: BattleStatsCardProps) {
  if (!stats) return null;

  const winRate = stats.totalBattles > 0 ? ((stats.wins / stats.totalBattles) * 100).toFixed(1) : '0.0';

  return (
    <div className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
      <h3 className="text-sm font-semibold text-white mb-3">⚔️ Battle Stats</h3>

      <div className="grid grid-cols-3 gap-3">
        <StatCell label="Win Rate" value={`${winRate}%`} color="text-green-400" />
        <StatCell label="W/L/D" value={`${stats.wins}/${stats.losses}/${stats.draws}`} />
        <StatCell label="Win Streak" value={`${stats.currentWinStreak}`} color="text-orange-400" />
        <StatCell label="Best Streak" value={`${stats.bestWinStreak}`} />
        <StatCell label="Total Staked" value={`${stats.totalStaked.toFixed(3)}`} />
        <StatCell label="Total Won" value={`${stats.totalWon.toFixed(3)}`} color="text-green-400" />
      </div>
    </div>
  );
}

function StatCell({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
    </div>
  );
}
