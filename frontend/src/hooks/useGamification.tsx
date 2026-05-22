/**
 * useGamification — Server-backed gamification context provider.
 * Replaces the localStorage orchestrator with server API calls.
 *
 * Provides action handlers that trigger server-side gamification events
 * and automatically refresh all related data.
 */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from './useAuth';
import { xpApi, badgesApi, reputationApi } from '@/lib/apiClient';

// ── Types ──────────────────────────────────────────────

interface GamificationContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Trigger gamification for placing a bet */
  onBetPlaced: () => Promise<void>;
  /** Trigger gamification for winning a bet */
  onBetWon: () => Promise<void>;
  /** Trigger gamification for market creation */
  onMarketCreated: () => Promise<void>;
  /** Trigger gamification for AI usage */
  onAIUsed: () => Promise<void>;
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

// ── Provider ───────────────────────────────────────────

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const { user, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user?.isLoggedIn;
  const [isLoading, setIsLoading] = useState(false);

  const triggerAction = useCallback(
    async (xpAmount: number, reason: string, repEventType: string) => {
      if (!address || !isAuthenticated) return;
      setIsLoading(true);
      try {
        await Promise.all([
          xpApi.award(address, xpAmount, reason, 'action'),
          reputationApi.record(address, repEventType),
          badgesApi.check(),
        ]);
      } catch {
        // Non-critical — don't block user
      } finally {
        setIsLoading(false);
      }
    },
    [address, isAuthenticated]
  );

  const onBetPlaced = useCallback(
    () => triggerAction(10, 'Bet placed', 'BET_PLACED'),
    [triggerAction]
  );

  const onBetWon = useCallback(
    () => triggerAction(25, 'Bet won', 'BET_WON'),
    [triggerAction]
  );

  const onMarketCreated = useCallback(
    () => triggerAction(20, 'Market created', 'MARKET_CREATED'),
    [triggerAction]
  );

  const onAIUsed = useCallback(
    () => triggerAction(5, 'AI assistant used', 'BET_PLACED'),
    [triggerAction]
  );

  const value: GamificationContextValue = {
    isAuthenticated,
    isLoading: isLoading || authLoading,
    onBetPlaced,
    onBetWon,
    onMarketCreated,
    onAIUsed,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
}
