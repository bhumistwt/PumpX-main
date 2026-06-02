import { prisma } from './db';

const CACHE_MS = 60 * 60 * 1000; // 1 hour

export interface PumpScoreEntry {
  rank: number;
  address: string;
  winRate: number;
  roiPercent: number;
  totalMarkets: number;
  totalBets: number;
  pumpScore: number;
  accuracy: number;
  roi: number;
  participation: number;
  consistency: number;
}

function normalizeRoiScore(roiPercent: number): number {
  return Math.min(100, Math.max(0, 50 + roiPercent / 2));
}

function computeConsistencyScore(betDates: Date[]): number {
  if (betDates.length === 0) return 0;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const activeWeeks = new Set<number>();

  for (const d of betDates) {
    const weeksAgo = Math.floor((now - d.getTime()) / weekMs);
    if (weeksAgo >= 0 && weeksAgo < 8) activeWeeks.add(weeksAgo);
  }

  return (activeWeeks.size / 8) * 100;
}

type UserBetAgg = {
  address: string;
  bets: Array<{
    amount: string;
    side: string;
    createdAt: Date;
    market: {
      contractAddress: string;
      resolved: boolean;
      reached: boolean;
      yesPool: string;
      noPool: string;
      stockTicker: string | null;
      question: string;
    };
  }>;
};

function computeUserMetrics(agg: UserBetAgg, maxBets: number) {
  const { bets } = agg;
  const marketMap = new Map<string, typeof bets>();

  for (const b of bets) {
    const list = marketMap.get(b.market.contractAddress) ?? [];
    list.push(b);
    marketMap.set(b.market.contractAddress, list);
  }

  let resolvedCount = 0;
  let wins = 0;
  let totalInvested = 0n;
  let totalReturn = 0n;
  const sectors = new Map<string, number>();

  for (const [, marketBets] of marketMap) {
    const m = marketBets[0].market;
    const sector = m.stockTicker || 'Crypto';
    sectors.set(sector, (sectors.get(sector) || 0) + 1);

    for (const b of marketBets) {
      totalInvested += BigInt(b.amount);
    }

    if (!m.resolved) continue;

    resolvedCount += 1;
    const totalStake = marketBets.reduce((s, b) => s + BigInt(b.amount), 0n);
    const wonSide = m.reached ? 'YES' : 'NO';
    const userWon = marketBets.some((b) => b.side === wonSide);

    if (userWon) {
      wins += 1;
      const winPool = BigInt(m.reached ? m.yesPool : m.noPool);
      const losePool = BigInt(m.reached ? m.noPool : m.yesPool);
      const total = winPool + losePool;
      for (const b of marketBets) {
        if (b.side === wonSide) {
          totalReturn += winPool > 0n ? (BigInt(b.amount) * total) / winPool : BigInt(b.amount);
        }
      }
    }
  }

  const accuracy = resolvedCount > 0 ? (wins / resolvedCount) * 100 : 0;
  const winRate = resolvedCount > 0 ? wins / resolvedCount : 0;
  const roiPercent =
    totalInvested > 0n
      ? (Number(totalReturn - totalInvested) / Number(totalInvested)) * 100
      : 0;
  const roi = normalizeRoiScore(roiPercent);
  const participation = maxBets > 0 ? Math.min(100, (bets.length / maxBets) * 100) : 0;
  const consistency = computeConsistencyScore(bets.map((b) => b.createdAt));

  const pumpScore =
    accuracy * 0.4 + roi * 0.3 + participation * 0.2 + consistency * 0.1;

  return {
    userAddress: agg.address,
    accuracy,
    roi,
    participation,
    consistency,
    winRate: winRate * 100,
    pumpScore: Math.round(pumpScore * 100) / 100,
    totalMarkets: marketMap.size,
    totalBets: bets.length,
    roiPercent: Math.round(roiPercent * 100) / 100,
  };
}

async function isCacheFresh(): Promise<boolean> {
  const latest = await prisma.pumpScore.findFirst({
    orderBy: { calculatedAt: 'desc' },
    select: { calculatedAt: true },
  });
  if (!latest) return false;
  return Date.now() - latest.calculatedAt.getTime() < CACHE_MS;
}

export async function recalculatePumpScores(): Promise<Date> {
  const allBets = await prisma.bet.findMany({
    include: {
      market: {
        select: {
          contractAddress: true,
          resolved: true,
          reached: true,
          yesPool: true,
          noPool: true,
          stockTicker: true,
          question: true,
        },
      },
    },
  });

  const byUser = new Map<string, UserBetAgg>();
  for (const bet of allBets) {
    const addr = bet.userAddress.toLowerCase();
    if (!byUser.has(addr)) byUser.set(addr, { address: addr, bets: [] });
    byUser.get(addr)!.bets.push(bet);
  }

  const maxBets = Math.max(1, ...Array.from(byUser.values()).map((u) => u.bets.length));
  const now = new Date();

  const rows = Array.from(byUser.values())
    .filter((u) => u.bets.length > 0)
    .map((u) => ({ ...computeUserMetrics(u, maxBets), calculatedAt: now }));

  await prisma.pumpScore.deleteMany();
  if (rows.length > 0) {
    await prisma.pumpScore.createMany({ data: rows });
  }

  return now;
}

export async function getPumpScoreLeaderboard(limit = 50): Promise<{
  entries: PumpScoreEntry[];
  calculatedAt: string | null;
}> {
  if (!(await isCacheFresh())) {
    await recalculatePumpScores();
  }

  const rows = await prisma.pumpScore.findMany({
    orderBy: { pumpScore: 'desc' },
    take: limit,
  });

  const latest = rows[0]?.calculatedAt ?? (await prisma.pumpScore.findFirst({ orderBy: { calculatedAt: 'desc' } }))?.calculatedAt;

  const entries: PumpScoreEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    address: r.userAddress,
    winRate: r.winRate,
    roiPercent: r.roiPercent,
    totalMarkets: r.totalMarkets,
    totalBets: r.totalBets,
    pumpScore: r.pumpScore,
    accuracy: r.accuracy,
    roi: r.roi,
    participation: r.participation,
    consistency: r.consistency,
  }));

  return {
    entries,
    calculatedAt: latest?.toISOString() ?? null,
  };
}
