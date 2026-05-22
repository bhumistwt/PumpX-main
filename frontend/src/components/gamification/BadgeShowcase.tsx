/**
 * BadgeShowcase — Trophy cabinet showing all badges with unlock status.
 * Includes badge unlock popup modal.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBadges, type BadgeItem } from '@/hooks/useBadges';
import { RARITY_COLORS, BADGE_DEFINITIONS, type BadgeRarity } from '@/lib/gamification';

/** Extended badge item with rarity info derived from BADGE_DEFINITIONS */
interface BadgeDisplayItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
  rarity: BadgeRarity;
  condition: string;
  rarityColor: string;
}

function toBadgeDisplay(badge: BadgeItem): BadgeDisplayItem {
  const def = BADGE_DEFINITIONS.find((d) => d.id === badge.id);
  const rarity: BadgeRarity = (def?.rarity as BadgeRarity) ?? 'Common';
  const rarityColor = RARITY_COLORS[rarity]?.text ?? '#9ca3af';
  return {
    ...badge,
    rarity,
    condition: def?.condition ?? '',
    rarityColor,
  };
}

interface BadgeShowcaseProps {
  /** Max badges to show in grid (null = all) */
  maxDisplay?: number | null;
  /** Show rarity filter tabs */
  showFilters?: boolean;
  className?: string;
}

const RARITY_ORDER: BadgeRarity[] = ['Legendary', 'Epic', 'Rare', 'Common'];

export function BadgeShowcase({ maxDisplay = null, showFilters = true, className = '' }: BadgeShowcaseProps) {
  const { badges, totalEarned, totalAvailable } = useBadges();
  const [selectedRarity, setSelectedRarity] = useState<BadgeRarity | 'all'>('all');
  const [selectedBadge, setSelectedBadge] = useState<BadgeDisplayItem | null>(null);

  const displayItems = badges.map(toBadgeDisplay);
  const byRarity: Record<string, BadgeDisplayItem[]> = {};
  for (const item of displayItems) {
    (byRarity[item.rarity] ??= []).push(item);
  }

  const filteredBadges = selectedRarity === 'all' ? displayItems : (byRarity[selectedRarity] ?? []);
  const finalBadges = maxDisplay ? filteredBadges.slice(0, maxDisplay) : filteredBadges;

  return (
    <div className={`rounded-xl p-4 border border-white/10 bg-white/5 backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          🏆 Badge Collection
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          {totalEarned}/{totalAvailable}
        </span>
      </div>

      {/* Rarity Filter Tabs */}
      {showFilters && (
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          <FilterTab
            label="All"
            active={selectedRarity === 'all'}
            onClick={() => setSelectedRarity('all')}
          />
          {RARITY_ORDER.map((rarity) => (
            <FilterTab
              key={rarity}
              label={rarity}
              color={RARITY_COLORS[rarity]?.text}
              active={selectedRarity === rarity}
              onClick={() => setSelectedRarity(rarity)}
              count={(byRarity[rarity] ?? []).filter((b: BadgeDisplayItem) => b.earned).length}
            />
          ))}
        </div>
      )}

      {/* Badge Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
        {finalBadges.map((badge: BadgeDisplayItem) => (
          <BadgeCell
            key={badge.id}
            badge={badge}
            onClick={() => setSelectedBadge(badge)}
          />
        ))}
      </div>

      {/* Badge Detail Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <BadgeDetailModal
            badge={selectedBadge}
            onClose={() => setSelectedBadge(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub Components ─────────────────────────────────────

function FilterTab({
  label,
  color,
  active,
  onClick,
  count,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-white/15 text-white'
          : 'text-[var(--text-muted)] hover:bg-white/5'
      }`}
      style={active && color ? { color } : undefined}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
    </button>
  );
}

function BadgeCell({ badge, onClick }: { badge: BadgeDisplayItem; onClick: () => void }) {
  const { earned, rarityColor } = badge;

  return (
    <motion.button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-colors aspect-square ${
        earned
          ? 'border-white/20 bg-white/5 hover:bg-white/10'
          : 'border-white/5 bg-white/[0.02] opacity-40'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-xl">{badge.icon}</span>
      {earned && (
        <div
          className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: rarityColor }}
        />
      )}
    </motion.button>
  );
}

function BadgeDetailModal({ badge, onClose }: { badge: BadgeDisplayItem; onClose: () => void }) {
  const { earned, earnedAt, rarityColor } = badge;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative w-80 rounded-2xl border border-white/15 bg-[var(--bg-primary)] p-6 text-center"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rarity glow border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-20 blur-xl"
          style={{ backgroundColor: rarityColor }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-white"
        >
          ✕
        </button>

        {/* Badge icon */}
        <motion.div
          className="text-6xl mb-3"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {badge.icon}
        </motion.div>

        {/* Badge name */}
        <h3 className="text-lg font-bold text-white mb-1">{badge.name}</h3>

        {/* Rarity tag */}
        <span
          className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-3"
          style={{ backgroundColor: `${rarityColor}20`, color: rarityColor }}
        >
          {badge.rarity.toUpperCase()}
        </span>

        {/* Description */}
        <p className="text-sm text-[var(--text-muted)] mb-4">{badge.description}</p>

        {/* Status */}
        {earned ? (
          <div className="text-xs text-green-400">
            ✓ Unlocked{' '}
            {earnedAt && new Date(earnedAt).toLocaleDateString()}
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)]">
            🔒 {badge.condition}
          </div>
        )}

        {/* XP Reward */}
        <div className="mt-2 text-xs" style={{ color: rarityColor }}>
          +{badge.xpReward} XP on unlock
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Badge Unlock Toast (for notifications) ─────────────

interface BadgeUnlockToastProps {
  badgeName: string;
  badgeIcon: string;
  rarity: BadgeRarity;
  onClose: () => void;
}

export function BadgeUnlockToast({ badgeName, badgeIcon, rarity, onClose }: BadgeUnlockToastProps) {
  const colorObj = RARITY_COLORS[rarity];
  const color = colorObj?.text ?? '#9ca3af';

  return (
    <motion.div
      className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border bg-[var(--bg-primary)]"
      style={{ borderColor: `${color}40` }}
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      onClick={onClose}
    >
      <motion.span
        className="text-3xl"
        animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {badgeIcon}
      </motion.span>
      <div>
        <div className="text-xs font-semibold" style={{ color }}>
          BADGE UNLOCKED
        </div>
        <div className="text-sm font-bold text-white">{badgeName}</div>
      </div>
    </motion.div>
  );
}
