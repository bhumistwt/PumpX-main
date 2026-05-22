/**
 * GET /api/leaderboard
 * Returns sorted leaderboard from real indexed data.
 * Supports: ?type=volume|winRate|bets|xp&limit=50&season=current
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../server/db';
import { withErrorHandler, withMethod, compose } from '../../server/middleware';
import { createLogger } from '../../server/logger';

const log = createLogger('api:leaderboard');

type LeaderboardType = 'volume' | 'winRate' | 'bets' | 'xp';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const type = (req.query.type as LeaderboardType) || 'volume';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

  switch (type) {
    case 'volume':
      return volumeLeaderboard(res, limit);
    case 'winRate':
      return winRateLeaderboard(res, limit);
    case 'bets':
      return betsLeaderboard(res, limit);
    case 'xp':
      return xpLeaderboard(res, limit);
    default:
      return res.status(400).json({ error: 'Invalid leaderboard type. Use: volume, winRate, bets, xp' });
  }
}

/** Leaderboard by total bet volume */
async function volumeLeaderboard(res: NextApiResponse, limit: number) {
  // amount is stored as String (wei), so we group by user and count, then compute volume in JS
  const results = await prisma.bet.groupBy({
    by: ['userAddress'],
    _count: { _all: true },
    orderBy: { _count: { userAddress: 'desc' } },
    take: limit * 2, // fetch extra for post-sort
  });

  // Fetch all bets for these users to sum amounts
  const addresses = results.map((r: any) => r.userAddress);
  const bets = await prisma.bet.findMany({
    where: { userAddress: { in: addresses } },
    select: { userAddress: true, amount: true },
  });

  // Sum volumes per user
  const volumeMap = new Map<string, bigint>();
  const countMap = new Map<string, number>();
  for (const b of bets) {
    volumeMap.set(b.userAddress, (volumeMap.get(b.userAddress) || BigInt(0)) + BigInt(b.amount || '0'));
    countMap.set(b.userAddress, (countMap.get(b.userAddress) || 0) + 1);
  }

  interface VolumeEntry {
    rank: number;
    address: string;
    totalVolume: string;
    totalBets: number;
  }
  const entries: VolumeEntry[] = addresses.map((addr: string) => ({
    rank: 0,
    address: addr,
    totalVolume: (volumeMap.get(addr) || BigInt(0)).toString(),
    totalBets: countMap.get(addr) || 0,
  }));

  // Sort by actual volume value (descending)
  entries.sort((a: VolumeEntry, b: VolumeEntry) => {
    const aVol = BigInt(a.totalVolume);
    const bVol = BigInt(b.totalVolume);
    return bVol > aVol ? 1 : bVol < aVol ? -1 : 0;
  });

  // Re-rank after sort
  entries.forEach((e: VolumeEntry, i: number) => e.rank = i + 1);

  res.status(200).json({ type: 'volume', entries: entries.slice(0, limit) });
}

/** Leaderboard by win rate — approximated by claim count vs bet count */
async function winRateLeaderboard(res: NextApiResponse, limit: number) {
  // Get all users who have placed bets, with their bet counts
  const users = await prisma.user.findMany({
    select: {
      address: true,
      _count: {
        select: {
          bets: true,
        },
      },
    },
    where: {
      bets: { some: {} },
    },
  });

  // Get claim counts per user from the Claim table
  const claimCounts = await prisma.claim.groupBy({
    by: ['userAddress'],
    _count: { _all: true },
  });
  const claimMap = new Map(claimCounts.map((c: any) => [c.userAddress, c._count._all]));

  interface WinRateEntry {
    rank: number;
    address: string;
    totalBets: number;
    wins: number;
    winRate: number;
  }
  const entries: WinRateEntry[] = users
    .map((u: any) => {
      const wins = claimMap.get(u.address) || 0;
      return {
        rank: 0,
        address: u.address,
        totalBets: u._count.bets,
        wins,
        winRate: u._count.bets > 0 ? wins / u._count.bets : 0,
      };
    })
    .sort((a: WinRateEntry, b: WinRateEntry) => b.winRate - a.winRate || b.wins - a.wins)
    .slice(0, limit)
    .map((e: WinRateEntry, i: number) => ({ ...e, rank: i + 1 }));

  res.status(200).json({ type: 'winRate', entries });
}

/** Leaderboard by number of bets */
async function betsLeaderboard(res: NextApiResponse, limit: number) {
  const results = await prisma.bet.groupBy({
    by: ['userAddress'],
    _count: { _all: true },
    orderBy: { _count: { userAddress: 'desc' } },
    take: limit,
  });

  const entries = results.map((r: any, i: number) => ({
    rank: i + 1,
    address: r.userAddress,
    totalBets: r._count._all,
  }));

  res.status(200).json({ type: 'bets', entries });
}

/** Leaderboard by XP accumulated */
async function xpLeaderboard(res: NextApiResponse, limit: number) {
  const results = await prisma.xPTransaction.groupBy({
    by: ['userAddress'],
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });

  const entries = results.map((r: any, i: number) => ({
    rank: i + 1,
    address: r.userAddress,
    totalXP: r._sum.amount || 0,
  }));

  res.status(200).json({ type: 'xp', entries });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
