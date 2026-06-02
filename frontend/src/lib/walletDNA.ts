export type TradingStyle = 'Sharp' | 'Whale' | 'Degen' | 'Casual';
export type ActivityLevel = 'active' | 'moderate' | 'inactive';

export interface WalletMarketBet {
  marketAddress: string;
  question: string;
  side: string;
  amount: string;
  status: 'active' | 'won' | 'lost' | 'expired';
  createdAt: string;
  stockTicker: string | null;
}

export interface WalletDNAStats {
  address: string;
  totalMarkets: number;
  totalBets: number;
  winRate: number;
  totalStakedEth: string;
  roiPercent: number;
  favoriteSector: string;
  tradingStyle: TradingStyle;
  activityLevel: ActivityLevel;
  recentMarkets: WalletMarketBet[];
}

const SECTOR_KEYWORDS: Array<{ sector: string; re: RegExp }> = [
  { sector: 'AI', re: /\b(ai|gpt|llm|agent)\b/i },
  { sector: 'Memecoins', re: /\b(meme|pepe|doge|shib)\b/i },
  { sector: 'DeFi', re: /\b(defi|yield|liquidity|swap)\b/i },
  { sector: 'Gaming', re: /\b(game|gaming|play)\b/i },
  { sector: 'DePIN', re: /\b(depin|infrastructure|storage)\b/i },
  { sector: 'RWA', re: /\b(rwa|real estate|treasury|bond)\b/i },
];

function inferSector(question: string, ticker: string | null): string {
  if (ticker) return ticker;
  for (const { sector, re } of SECTOR_KEYWORDS) {
    if (re.test(question)) return sector;
  }
  return 'Crypto';
}

export function computeWalletDNA(
  address: string,
  bets: Array<{
    amount: string;
    side: string;
    createdAt: Date;
    market: {
      contractAddress: string;
      question: string;
      resolved: boolean;
      reached: boolean;
      deadline: Date;
      yesPool: string;
      noPool: string;
      stockTicker: string | null;
    };
  }>,
): WalletDNAStats {
  const empty: WalletDNAStats = {
    address,
    totalMarkets: 0,
    totalBets: 0,
    winRate: 0,
    totalStakedEth: '0',
    roiPercent: 0,
    favoriteSector: '--',
    tradingStyle: 'Casual',
    activityLevel: 'inactive',
    recentMarkets: [],
  };

  if (bets.length === 0) return empty;

  const marketMap = new Map<string, typeof bets>();
  for (const b of bets) {
    const key = b.market.contractAddress;
    const list = marketMap.get(key) ?? [];
    list.push(b);
    marketMap.set(key, list);
  }

  let resolved = 0;
  let wins = 0;
  let totalInvested = 0n;
  let totalReturn = 0n;
  const sectorCounts = new Map<string, number>();

  const recentMarkets: WalletMarketBet[] = [];

  for (const [addr, marketBets] of marketMap) {
    const m = marketBets[0].market;
    const sector = inferSector(m.question, m.stockTicker);
    sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);

    let status: WalletMarketBet['status'] = 'active';
    if (m.resolved) {
      const wonSide = m.reached ? 'YES' : 'NO';
      const userWon = marketBets.some((b) => b.side === wonSide);
      status = userWon ? 'won' : 'lost';
      resolved += 1;
      if (userWon) wins += 1;
      const winPool = BigInt(m.reached ? m.yesPool : m.noPool);
      const losePool = BigInt(m.reached ? m.noPool : m.yesPool);
      const total = winPool + losePool;
      for (const b of marketBets) {
        totalInvested += BigInt(b.amount);
        if (b.side === wonSide && winPool > 0n) {
          totalReturn += (BigInt(b.amount) * total) / winPool;
        }
      }
    } else if (new Date(m.deadline) < new Date()) {
      status = 'expired';
      for (const b of marketBets) totalInvested += BigInt(b.amount);
    } else {
      for (const b of marketBets) totalInvested += BigInt(b.amount);
    }

    const latest = marketBets.sort((a, c) => c.createdAt.getTime() - a.createdAt.getTime())[0];
    recentMarkets.push({
      marketAddress: addr,
      question: m.question,
      side: latest.side,
      amount: marketBets.reduce((s, b) => s + BigInt(b.amount), 0n).toString(),
      status,
      createdAt: latest.createdAt.toISOString(),
      stockTicker: m.stockTicker,
    });
  }

  recentMarkets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const winRate = resolved > 0 ? (wins / resolved) * 100 : 0;
  const roiPercent =
    totalInvested > 0n
      ? (Number(totalReturn - totalInvested) / Number(totalInvested)) * 100
      : 0;

  const totalStakedEth = (Number(totalInvested) / 1e18).toFixed(4);

  const favoriteSector =
    [...sectorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Crypto';

  const avgBetEth = Number(totalInvested) / 1e18 / bets.length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const betsLastWeek = bets.filter((b) => b.createdAt.getTime() >= weekAgo).length;

  let tradingStyle: TradingStyle = 'Casual';
  if (winRate > 70) tradingStyle = 'Sharp';
  else if (avgBetEth > 1) tradingStyle = 'Whale';
  else if (betsLastWeek > 10) tradingStyle = 'Degen';

  const lastBet = bets.reduce((max, b) => (b.createdAt > max ? b.createdAt : max), bets[0].createdAt);
  const daysSince = (Date.now() - lastBet.getTime()) / (24 * 60 * 60 * 1000);
  let activityLevel: ActivityLevel = 'inactive';
  if (daysSince <= 7) activityLevel = 'active';
  else if (daysSince <= 30) activityLevel = 'moderate';

  return {
    address,
    totalMarkets: marketMap.size,
    totalBets: bets.length,
    winRate: Math.round(winRate * 10) / 10,
    totalStakedEth,
    roiPercent: Math.round(roiPercent * 100) / 100,
    favoriteSector,
    tradingStyle,
    activityLevel,
    recentMarkets: recentMarkets.slice(0, 10),
  };
}
