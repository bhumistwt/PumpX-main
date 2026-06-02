import { prisma } from '../../server/db';
import { callOpenAIChat } from './openai';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface MarketAnalysisResult {
  bullCase: string[];
  bearCase: string[];
  confidenceScore: number;
  riskLevel: RiskLevel;
  cached: boolean;
  generatedAt?: string;
  cachedUntil?: string;
}

const CACHE_HOURS = 6;
const OPENAI_MODEL = 'gpt-4o-mini';

function normalizeMarketId(marketId: string): string {
  return marketId.toLowerCase();
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return [];
}

function rowToResult(
  row: {
    bullCase: unknown;
    bearCase: unknown;
    confidenceScore: number;
    riskLevel: string;
    generatedAt: Date;
    cachedUntil: Date;
  },
  cached: boolean,
): MarketAnalysisResult {
  return {
    bullCase: parseJsonArray(row.bullCase),
    bearCase: parseJsonArray(row.bearCase),
    confidenceScore: row.confidenceScore,
    riskLevel: row.riskLevel as RiskLevel,
    cached,
    generatedAt: row.generatedAt.toISOString(),
    cachedUntil: row.cachedUntil.toISOString(),
  };
}

async function callOpenAiAnalysis(
  marketId: string,
  tokenAddress: string,
  question: string,
): Promise<Omit<MarketAnalysisResult, 'cached' | 'generatedAt' | 'cachedUntil'> | null> {
  const prompt = `You are a crypto prediction market analyst. Analyze this market briefly.

Market contract: ${marketId}
Token: ${tokenAddress}
Question: ${question}

Respond with ONLY valid JSON (no markdown):
{
  "bullCase": ["reason 1", "reason 2", "reason 3"],
  "bearCase": ["reason 1", "reason 2", "reason 3"],
  "confidenceScore": 0-100 integer,
  "riskLevel": "Low" | "Medium" | "High"
}`;

  const content = await callOpenAIChat(
    'market-analysis',
    [
      { role: 'system', content: 'Return concise, factual JSON only.' },
      { role: 'user', content: prompt },
    ],
    { model: OPENAI_MODEL },
  );

  if (!content) return null;

  const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
  const parsed = JSON.parse(cleaned) as {
    bullCase?: string[];
    bearCase?: string[];
    confidenceScore?: number;
    riskLevel?: string;
  };

  const risk = parsed.riskLevel;
  const riskLevel: RiskLevel =
    risk === 'Low' || risk === 'Medium' || risk === 'High' ? risk : 'Medium';

  return {
    bullCase: parseJsonArray(parsed.bullCase).slice(0, 5),
    bearCase: parseJsonArray(parsed.bearCase).slice(0, 5),
    confidenceScore: Math.min(100, Math.max(0, Math.round(parsed.confidenceScore ?? 50))),
    riskLevel,
  };
}

/**
 * Returns cached analysis or generates a new one (6h cache).
 */
export async function analyzeMarket(
  marketId: string,
  tokenAddress: string,
): Promise<MarketAnalysisResult> {
  const id = normalizeMarketId(marketId);
  const now = new Date();

  const cached = await prisma.aiMarketAnalysis.findUnique({
    where: { marketId: id },
  });

  if (cached && cached.cachedUntil > now) {
    return rowToResult(cached, true);
  }

  const market = await prisma.market.findUnique({
    where: { contractAddress: id },
    select: { question: true, tokenAddress: true },
  });

  if (!market) {
    throw new Error('Market not found');
  }

  const token = tokenAddress || market.tokenAddress;
  const analysis = await callOpenAiAnalysis(id, token, market.question);

  if (!analysis) {
    throw new Error('AI analysis unavailable');
  }

  const cachedUntil = new Date(now.getTime() + CACHE_HOURS * 60 * 60 * 1000);

  const saved = await prisma.aiMarketAnalysis.upsert({
    where: { marketId: id },
    create: {
      marketId: id,
      bullCase: analysis.bullCase,
      bearCase: analysis.bearCase,
      confidenceScore: analysis.confidenceScore,
      riskLevel: analysis.riskLevel,
      generatedAt: now,
      cachedUntil,
    },
    update: {
      bullCase: analysis.bullCase,
      bearCase: analysis.bearCase,
      confidenceScore: analysis.confidenceScore,
      riskLevel: analysis.riskLevel,
      generatedAt: now,
      cachedUntil,
    },
  });

  return rowToResult(saved, false);
}

export async function getCachedMarketAnalysis(
  marketId: string,
): Promise<MarketAnalysisResult | null> {
  const id = normalizeMarketId(marketId);
  const row = await prisma.aiMarketAnalysis.findUnique({ where: { marketId: id } });
  if (!row || row.cachedUntil <= new Date()) return null;
  return rowToResult(row, true);
}
