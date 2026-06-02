import { prisma } from './db';

const WHALE_THRESHOLD_WEI = BigInt('100000000000000000'); // 0.1 ETH

function normalize(addr: string): string {
  return addr.toLowerCase();
}

/**
 * Sync whale alerts from recent large bets (idempotent by txHash).
 */
export async function syncWhaleAlertsFromBets(limit = 50): Promise<void> {
  const bets = await prisma.bet.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      market: { select: { tokenAddress: true } },
    },
  });

  for (const bet of bets) {
    if (BigInt(bet.amount) < WHALE_THRESHOLD_WEI) continue;

    const action = bet.side === 'YES' ? 'BUY_YES' : 'BUY_NO';

    await prisma.whaleAlert.upsert({
      where: { txHash: bet.txHash },
      create: {
        walletAddress: normalize(bet.userAddress),
        action,
        tokenAddress: normalize(bet.market.tokenAddress),
        amount: bet.amount,
        txHash: bet.txHash,
        createdAt: bet.createdAt,
      },
      update: {},
    });
  }

  // Trim old alerts beyond reasonable feed size
  const excess = await prisma.whaleAlert.findMany({
    orderBy: { createdAt: 'desc' },
    skip: limit * 4,
    select: { id: true },
  });

  if (excess.length > 0) {
    await prisma.whaleAlert.deleteMany({
      where: { id: { in: excess.map((e) => e.id) } },
    });
  }
}

export async function getRecentWhaleAlerts(limit = 20) {
  await syncWhaleAlertsFromBets(limit);

  return prisma.whaleAlert.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
