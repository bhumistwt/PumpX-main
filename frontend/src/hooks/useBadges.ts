/**
 * useBadges — Server-backed badge management.
 * All data from /api/gamification/badges (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { badgesApi } from '@/lib/apiClient';

export interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}

export interface BadgesHookData {
  badges: BadgeItem[];
  totalEarned: number;
  totalAvailable: number;
  isLoading: boolean;
  /** Check for newly earned badges (requires auth) */
  checkBadges: () => Promise<string[]>;
  refresh: () => void;
}

export function useBadges(): BadgesHookData {
  const { address } = useAccount();
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const result = await badgesApi.get(address);
      setBadges(result.badges);
      setTotalEarned(result.totalEarned);
      setTotalAvailable(result.totalAvailable);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkBadges = useCallback(async (): Promise<string[]> => {
    try {
      const result = await badgesApi.check();
      await refresh();
      return result.newlyEarned;
    } catch {
      return [];
    }
  }, [refresh]);

  return {
    badges,
    totalEarned,
    totalAvailable,
    isLoading,
    checkBadges,
    refresh,
  };
}
