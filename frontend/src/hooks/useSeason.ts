/**
 * useSeason — Server-backed season data.
 * All data from /api/gamification/seasons (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { seasonsApi } from '@/lib/apiClient';

export interface SeasonHookData {
  season: any | null;
  isLoading: boolean;
  refresh: () => void;
}

export function useSeason(): SeasonHookData {
  const [season, setSeason] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await seasonsApi.get();
      setSeason(result.season);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    season,
    isLoading,
    refresh,
  };
}
