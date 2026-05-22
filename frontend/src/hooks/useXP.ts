/**
 * useXP — Server-backed XP and level data.
 * All data fetched from /api/gamification/xp (PostgreSQL-backed).
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { xpApi } from '@/lib/apiClient';

export interface XPHookData {
  /** Current XP total */
  currentXP: number;
  /** Current level */
  level: number;
  /** XP needed for next level */
  nextThreshold: number;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** XP history */
  history: any[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Refresh data */
  refresh: () => void;
}

export function useXP(): XPHookData {
  const { address } = useAccount();
  const [data, setData] = useState<{
    currentXP: number;
    level: number;
    nextThreshold: number;
    history: any[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const result = await xpApi.get(address);
      setData(result);
    } catch {
      // Silently fail for XP display
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentXP = data?.currentXP ?? 0;
  const level = data?.level ?? 0;
  const nextThreshold = data?.nextThreshold ?? 100;
  const progressPercent =
    nextThreshold > 0 ? Math.min(100, Math.round((currentXP / nextThreshold) * 100)) : 0;

  return {
    currentXP,
    level,
    nextThreshold,
    progressPercent,
    history: data?.history ?? [],
    isLoading,
    refresh,
  };
}
