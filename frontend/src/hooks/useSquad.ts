/**
 * useSquad — Server-backed squad management.
 * All data from /api/gamification/squads (PostgreSQL-backed).
 */
import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { squadsApi } from '@/lib/apiClient';

export interface SquadHookData {
  squads: any[];
  userSquad: any | null;
  isLoading: boolean;
  /** Create a new squad */
  create: (name: string, tag: string, description?: string) => Promise<any | null>;
  /** Join a squad */
  join: (squadId: string) => Promise<boolean>;
  /** Leave current squad */
  leave: (squadId: string) => Promise<boolean>;
  refresh: () => void;
}

export function useSquad(): SquadHookData {
  const { address } = useAccount();
  const [squads, setSquads] = useState<any[]>([]);
  const [userSquad, setUserSquad] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await squadsApi.list();
      setSquads(result.squads);
      // Find user's squad
      if (address) {
        const mySquad = result.squads.find((s: any) =>
          s.members?.some((m: any) => m.userAddress === address.toLowerCase())
        );
        setUserSquad(mySquad || null);
      }
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
    async (name: string, tag: string, description?: string) => {
      try {
        const result = await squadsApi.create(name, tag, description);
        await refresh();
        return result.squad;
      } catch {
        return null;
      }
    },
    [refresh]
  );

  const join = useCallback(
    async (squadId: string) => {
      try {
        await squadsApi.join(squadId);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [refresh]
  );

  const leave = useCallback(
    async (squadId: string) => {
      try {
        await squadsApi.leave(squadId);
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [refresh]
  );

  return {
    squads,
    userSquad,
    isLoading,
    create,
    join,
    leave,
    refresh,
  };
}
