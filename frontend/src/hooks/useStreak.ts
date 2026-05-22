/**
 * useStreak — Server-backed streak tracking.
 * All data from /api/gamification/streaks (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { streakApi } from '@/lib/apiClient';

export interface StreakHookData {
  currentStreak: number;
  longestStreak: number;
  lastCheckIn: string | null;
  isCheckedInToday: boolean;
  isLoading: boolean;
  /** Check in for today */
  checkIn: () => Promise<{ xpAwarded: number } | null>;
  refresh: () => void;
}

export function useStreak(): StreakHookData {
  const { address } = useAccount();
  const [data, setData] = useState<{
    currentStreak: number;
    longestStreak: number;
    lastCheckIn: string | null;
    isCheckedInToday: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const result = await streakApi.get(address);
      setData(result);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const checkIn = useCallback(async () => {
    try {
      const result = await streakApi.checkIn();
      await refresh();
      return { xpAwarded: result.xpAwarded };
    } catch {
      return null;
    }
  }, [refresh]);

  return {
    currentStreak: data?.currentStreak ?? 0,
    longestStreak: data?.longestStreak ?? 0,
    lastCheckIn: data?.lastCheckIn ?? null,
    isCheckedInToday: data?.isCheckedInToday ?? false,
    isLoading,
    checkIn,
    refresh,
  };
}
