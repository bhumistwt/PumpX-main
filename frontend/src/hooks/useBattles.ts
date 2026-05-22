/**
 * useBattles — Server-backed PvP battle management.
 * All data from /api/gamification/battles (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { battlesApi } from '@/lib/apiClient';

export interface BattlesHookData {
  activeBattles: any[];
  completedBattles: any[];
  isLoading: boolean;
  /** Create a new battle */
  create: (opponentAddress: string, metric: string, wager?: string, durationHours?: number) => Promise<any | null>;
  refresh: () => void;
}

export function useBattles(): BattlesHookData {
  const { address } = useAccount();
  const [activeBattles, setActiveBattles] = useState<any[]>([]);
  const [completedBattles, setCompletedBattles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const [activeRes, completedRes] = await Promise.all([
        battlesApi.list('active'),
        battlesApi.list('completed'),
      ]);
      setActiveBattles(activeRes.battles);
      setCompletedBattles(completedRes.battles);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (opponentAddress: string, metric: string, wager?: string, durationHours?: number) => {
      try {
        const result = await battlesApi.create(opponentAddress, metric, wager, durationHours);
        await refresh();
        return result.battle;
      } catch {
        return null;
      }
    },
    [refresh]
  );

  return {
    activeBattles,
    completedBattles,
    isLoading,
    create,
    refresh,
  };
}
