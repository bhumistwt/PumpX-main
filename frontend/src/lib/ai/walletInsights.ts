import { prisma } from '../../server/db';
import { callOpenAIChat } from './openai';
import type { WalletDNAStats } from '../walletDNA';

export interface WalletAiInsights {
  summary: string;
  bullets: string[];
  available: boolean;
  cached: boolean;
}

const CACHE_HOURS = 24;

function defaultUsername(address: string): string {
  return `dna_${address.slice(2, 14)}`.slice(0, 30);
}

export async function getWalletAiInsights(
  stats: WalletDNAStats,
): Promise<WalletAiInsights> {
  const address = stats.address.toLowerCase();

  if (stats.totalBets < 5) {
    return {
      summary: '',
      bullets: [],
      available: false,
      cached: false,
    };
  }

  const now = new Date();
  const profile = await prisma.userProfile.findUnique({ where: { address } });

  if (
    profile?.aiInsights &&
    profile.aiInsightsCachedAt &&
    profile.aiInsightsCachedAt.getTime() + CACHE_HOURS * 60 * 60 * 1000 > now.getTime()
  ) {
    const cached = profile.aiInsights as { summary?: string; bullets?: string[] };
    return {
      summary: cached.summary ?? '',
      bullets: Array.isArray(cached.bullets) ? cached.bullets.slice(0, 3) : [],
      available: true,
      cached: true,
    };
  }

  const content = await callOpenAIChat('wallet-insights', [
    {
      role: 'system',
      content:
        'You analyze crypto prediction market traders. Respond with JSON only, no markdown.',
    },
    {
      role: 'user',
      content: `Wallet ${address}
Total bets: ${stats.totalBets}
Markets: ${stats.totalMarkets}
Win rate: ${stats.winRate}%
ROI: ${stats.roiPercent}%
Staked: ${stats.totalStakedEth} ETH
Style: ${stats.tradingStyle}
Activity: ${stats.activityLevel}
Favorite sector: ${stats.favoriteSector}

Return JSON:
{
  "summary": "one paragraph personality summary",
  "bullets": ["insight 1", "insight 2", "insight 3"]
}`,
    },
  ]);

  if (!content) {
    return {
      summary: '',
      bullets: [],
      available: false,
      cached: false,
    };
  }

  let parsed: { summary?: string; bullets?: string[] };
  try {
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      summary: '',
      bullets: [],
      available: false,
      cached: false,
    };
  }

  const payload = {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    bullets: Array.isArray(parsed.bullets)
      ? parsed.bullets.filter((b): b is string => typeof b === 'string').slice(0, 3)
      : [],
  };

  await prisma.userProfile.upsert({
    where: { address },
    create: {
      address,
      username: profile?.username ?? defaultUsername(address),
      aiInsights: payload,
      aiInsightsCachedAt: now,
    },
    update: {
      aiInsights: payload,
      aiInsightsCachedAt: now,
    },
  });

  return {
    summary: payload.summary,
    bullets: payload.bullets,
    available: true,
    cached: false,
  };
}
