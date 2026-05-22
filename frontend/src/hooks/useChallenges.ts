/**
 * useChallenges — Server-backed daily challenge tracking.
 * All data from /api/gamification/challenges (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { challengesApi } from '@/lib/apiClient';

export interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  xpReward: number;
  type: string;
  progress: number;
  completed: boolean;
}

export interface ChallengesHookData {
  challenges: Challenge[];
  completedCount: number;
  totalCount: number;
  isLoading: boolean;
  /** Update challenge progress */
  updateProgress: (challengeId: string, progress: number) => Promise<{ xpAwarded: number } | null>;
  refresh: () => void;
}

export function useChallenges(): ChallengesHookData {
  const { address } = useAccount();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await challengesApi.get(address);
      setChallenges(result.challenges);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProgress = useCallback(
    async (challengeId: string, progress: number) => {
      try {
        const result = await challengesApi.update(challengeId, progress);
        await refresh();
        return { xpAwarded: result.xpAwarded };
      } catch {
        return null;
      }
    },
    [refresh]
  );

  const completedCount = challenges.filter((c) => c.completed).length;
  const totalCount = challenges.length;

  return {
    challenges,
    completedCount,
    totalCount,
    isLoading,
    updateProgress,
    refresh,
  };
}
