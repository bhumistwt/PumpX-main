/**
 * Typed API client for PumpX server-side endpoints.
 * All client hooks use this instead of direct localStorage access.
 */

const BASE_URL = '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include', // Include session cookies
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `API error ${res.status}`, body);
  }

  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Auth ──────────────────────────────────────────────

export const authApi = {
  getNonce: () => apiFetch<{ nonce: string }>('/api/auth/nonce'),
  verify: (message: string, signature: string) =>
    apiFetch<{ ok: boolean; address: string; chainId: number; role: string }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }),
  me: () => apiFetch<{ isLoggedIn: boolean; address?: string; role?: string; chainId?: number }>('/api/auth/me'),
  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};

// ── Markets ──────────────────────────────────────────

export interface MarketData {
  contractAddress: string;
  chainId: number;
  creatorAddress: string;
  tokenAddress: string;
  question: string;
  threshold: string;
  deadline: string;
  yesPool: string;
  noPool: string;
  resolved: boolean;
  reached: boolean | null;
  initialSupply: string;
  latestSupply: string;
  txHash: string;
  blockNumber: number;
  createdAt: string;
  _count?: { bets: number };
}

export interface MarketsResponse {
  markets: MarketData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const marketsApi = {
  list: (params?: {
    status?: 'active' | 'resolved' | 'expired';
    chainId?: number;
    creator?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    }
    const query = qs.toString();
    return apiFetch<MarketsResponse>(`/api/markets${query ? `?${query}` : ''}`);
  },

  get: (address: string) =>
    apiFetch<{ market: MarketData & { bets: any[]; claims: any[] } }>(`/api/markets/${address}`),

  register: (contractAddress: string, question: string, chainId: number) =>
    apiFetch<{ market: MarketData }>('/api/markets', {
      method: 'POST',
      body: JSON.stringify({ contractAddress, question, chainId }),
    }),
};

// ── Leaderboard ──────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  address: string;
  [key: string]: any;
}

export const leaderboardApi = {
  get: (type: 'pumpScore' | 'volume' | 'winRate' | 'bets' | 'xp' = 'pumpScore', limit = 50) =>
    apiFetch<{ type: string; entries: LeaderboardEntry[]; calculatedAt?: string }>(
      `/api/leaderboard?type=${type}&limit=${limit}`,
    ),
};

// ── Gamification ─────────────────────────────────────

export const xpApi = {
  get: (address: string) =>
    apiFetch<{
      address: string;
      level: number;
      currentXP: number;
      nextThreshold: number;
      history: any[];
    }>(`/api/gamification/xp?address=${address}`),

  award: (address: string, amount: number, reason: string, source?: string) =>
    apiFetch<{ xpTransaction: any; level: number; currentXP: number; nextThreshold: number }>(
      '/api/gamification/xp',
      {
        method: 'POST',
        body: JSON.stringify({ address, amount, reason, source }),
      }
    ),
};

export const streakApi = {
  get: (address: string) =>
    apiFetch<{
      address: string;
      currentStreak: number;
      longestStreak: number;
      lastCheckIn: string | null;
      isCheckedInToday: boolean;
    }>(`/api/gamification/streaks?address=${address}`),

  checkIn: () =>
    apiFetch<{
      currentStreak: number;
      longestStreak: number;
      lastCheckIn: string;
      xpAwarded: number;
    }>('/api/gamification/streaks', { method: 'POST' }),
};

export const badgesApi = {
  get: (address: string) =>
    apiFetch<{
      address: string;
      badges: Array<{
        id: string;
        name: string;
        description: string;
        icon: string;
        xpReward: number;
        earned: boolean;
        earnedAt: string | null;
      }>;
      totalEarned: number;
      totalAvailable: number;
    }>(`/api/gamification/badges?address=${address}`),

  check: () =>
    apiFetch<{ newlyEarned: string[]; totalBadges: number }>('/api/gamification/badges', {
      method: 'POST',
    }),
};

export const challengesApi = {
  get: (address?: string) => {
    const qs = address ? `?address=${address}` : '';
    return apiFetch<{
      challenges: Array<{
        id: string;
        name: string;
        description: string;
        target: number;
        xpReward: number;
        type: string;
        progress: number;
        completed: boolean;
      }>;
    }>(`/api/gamification/challenges${qs}`);
  },

  update: (challengeId: string, progress: number) =>
    apiFetch<{
      challengeId: string;
      progress: number;
      target: number;
      completed: boolean;
      xpAwarded: number;
    }>('/api/gamification/challenges', {
      method: 'POST',
      body: JSON.stringify({ challengeId, progress }),
    }),
};

export const squadsApi = {
  list: () => apiFetch<{ squads: any[] }>('/api/gamification/squads'),
  get: (id: string) => apiFetch<{ squad: any }>(`/api/gamification/squads/${id}`),
  create: (name: string, tag: string, description?: string) =>
    apiFetch<{ squad: any }>('/api/gamification/squads', {
      method: 'POST',
      body: JSON.stringify({ name, tag, description }),
    }),
  join: (id: string) =>
    apiFetch<{ message: string }>(`/api/gamification/squads/${id}`, { method: 'POST' }),
  leave: (id: string) =>
    apiFetch<{ message: string }>(`/api/gamification/squads/${id}`, { method: 'DELETE' }),
};

export const battlesApi = {
  list: (status: 'active' | 'completed' = 'active', limit = 20) =>
    apiFetch<{ battles: any[] }>(`/api/gamification/battles?status=${status}&limit=${limit}`),

  create: (opponentAddress: string, metric: string, wager?: string, durationHours?: number) =>
    apiFetch<{ battle: any }>('/api/gamification/battles', {
      method: 'POST',
      body: JSON.stringify({ opponentAddress, metric, wager, durationHours: durationHours || 24 }),
    }),
};

export const reputationApi = {
  get: (address: string) =>
    apiFetch<{
      address: string;
      score: number;
      tier: string;
      events: any[];
    }>(`/api/gamification/reputation?address=${address}`),

  record: (address: string, eventType: string, details?: string) =>
    apiFetch<{ score: number; tier: string; delta: number }>('/api/gamification/reputation', {
      method: 'POST',
      body: JSON.stringify({ address, eventType, details }),
    }),
};

export const seasonsApi = {
  get: () => apiFetch<{ season: any }>('/api/gamification/seasons'),
};
