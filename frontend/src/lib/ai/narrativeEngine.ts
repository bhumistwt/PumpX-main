import { prisma } from '../../server/db';

export type TrendDirection = 'UP' | 'DOWN' | 'FLAT';

export interface NarrativeCard {
  id: string;
  name: string;
  mentionGrowth: number;
  sentiment: number;
  trendDirection: TrendDirection;
  marketCount: number;
  updatedAt: string;
}

const NARRATIVE_SEEDS: Array<{
  name: string;
  keywords: RegExp;
  baseGrowth: number;
  baseSentiment: number;
}> = [
  { name: 'AI', keywords: /\b(ai|gpt|llm|artificial|agent)\b/i, baseGrowth: 12.4, baseSentiment: 0.62 },
  { name: 'Memecoins', keywords: /\b(meme|pepe|doge|shib|bonk)\b/i, baseGrowth: 8.1, baseSentiment: 0.48 },
  { name: 'DeFi', keywords: /\b(defi|yield|liquidity|swap|amm)\b/i, baseGrowth: 5.6, baseSentiment: 0.55 },
  { name: 'Gaming', keywords: /\b(game|gaming|play|esport)\b/i, baseGrowth: 3.2, baseSentiment: 0.51 },
  { name: 'DePIN', keywords: /\b(depin|infrastructure|storage|compute)\b/i, baseGrowth: 6.8, baseSentiment: 0.58 },
  { name: 'RWA', keywords: /\b(rwa|real estate|treasury|bond|tokenized)\b/i, baseGrowth: 4.4, baseSentiment: 0.54 },
];

function growthToDirection(growth: number): TrendDirection {
  if (growth > 2) return 'UP';
  if (growth < -2) return 'DOWN';
  return 'FLAT';
}

function countMarketsForNarrative(
  markets: Array<{ question: string }>,
  keywords: RegExp,
): number {
  return markets.filter((m) => keywords.test(m.question)).length;
}

/**
 * Trending narratives: seeded metadata + live market counts from Prisma.
 */
export async function getTrendingNarratives(): Promise<NarrativeCard[]> {
  const markets = await prisma.market.findMany({
    select: { question: true },
    take: 500,
  });

  const now = new Date();

  const cards = await Promise.all(
    NARRATIVE_SEEDS.map(async (seed) => {
      const marketCount = countMarketsForNarrative(markets, seed.keywords);
      const mentionGrowth = seed.baseGrowth + marketCount * 0.85;
      const sentiment = Math.min(0.95, Math.max(0.15, seed.baseSentiment + marketCount * 0.01));
      const trendDirection = growthToDirection(mentionGrowth);

      const row = await prisma.narrativeTrend.upsert({
        where: { name: seed.name },
        create: {
          name: seed.name,
          mentionGrowth,
          sentiment,
          trendDirection,
          updatedAt: now,
        },
        update: {
          mentionGrowth,
          sentiment,
          trendDirection,
          updatedAt: now,
        },
      });

      return {
        id: row.id,
        name: row.name,
        mentionGrowth: Math.round(row.mentionGrowth * 10) / 10,
        sentiment: Math.round(row.sentiment * 100),
        trendDirection: row.trendDirection as TrendDirection,
        marketCount,
        updatedAt: row.updatedAt.toISOString(),
      };
    }),
  );

  return cards.sort((a, b) => b.mentionGrowth - a.mentionGrowth);
}
