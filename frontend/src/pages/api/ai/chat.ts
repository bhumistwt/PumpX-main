/**
 * PumpX AI Chat API Route
 *
 * POST /api/ai/chat
 *
 * Proxies to RedPill (Phala Network) or any OpenAI-compatible API.
 * Supports native function calling with JSON fallback parsing.
 *
 * Request body: { messages: AIRequestMessage[], context?: { isConnected, address, chainId } }
 * Response:     { type: 'message' | 'function_call', message?: string, function_call?: { name, arguments } }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { availableFunctions, FUNCTION_NAMES } from '../../../lib/ai/functions';
import { buildSystemPrompt } from '../../../lib/ai/prompt';
import type { AIRequestMessage, AIResponse } from '../../../lib/ai/types';
import type { PolyMarket } from './../../api/markets/trending';

// Curated real-world markets fallback (used when API unreachable)
const FALLBACK_TRENDING = [
  { question: 'Will Bitcoin reach $200,000 in 2025?', yesOdds: '38%', volume: '180K', category: 'Crypto' },
  { question: 'Will Ethereum reach $5,000 in 2025?', yesOdds: '45%', volume: '130K', category: 'Crypto' },
  { question: 'Will Trump sign an executive order on AI regulation in 2025?', yesOdds: '67%', volume: '95K', category: 'Politics' },
  { question: 'Will the Fed cut rates at the March 2025 FOMC meeting?', yesOdds: '22%', volume: '210K', category: 'Economics' },
  { question: 'Will NVIDIA maintain a $3T+ market cap through Q2 2025?', yesOdds: '58%', volume: '115K', category: 'Stocks' },
  { question: 'Will there be a ceasefire in Ukraine before July 2025?', yesOdds: '41%', volume: '290K', category: 'Geopolitics' },
  { question: 'Will Solana (SOL) exceed $300 in 2025?', yesOdds: '52%', volume: '88K', category: 'Crypto' },
  { question: 'Will OpenAI release GPT-5 before July 2025?', yesOdds: '71%', volume: '165K', category: 'Technology' },
  { question: 'Will the Kansas City Chiefs win Super Bowl LX?', yesOdds: '29%', volume: '340K', category: 'Sports' },
  { question: 'Will the SEC fully drop its case against Ripple (XRP) in 2025?', yesOdds: '69%', volume: '128K', category: 'Crypto' },
  { question: 'Will Tesla (TSLA) trade above $400 by end of 2025?', yesOdds: '43%', volume: '195K', category: 'Stocks' },
  { question: 'Will a Dogecoin ETF be approved in the US in 2025?', yesOdds: '31%', volume: '58K', category: 'Crypto' },
];

// In-memory cache for trending markets (shared across requests)
let trendingCache: { data: typeof FALLBACK_TRENDING; ts: number } | null = null;
const TRENDING_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

async function fetchTrendingForContext(): Promise<typeof FALLBACK_TRENDING> {
  if (trendingCache && Date.now() - trendingCache.ts < TRENDING_CACHE_TTL) {
    return trendingCache.data;
  }
  try {
    // Call our own /api/markets/trending which has the curated fallback built in
    // Use a relative URL by constructing from environment or using direct fetch
    const res = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=12', {
      headers: { 'User-Agent': 'PumpX/1.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error('api error');
    const raw = await res.json() as any[];
    const markets = raw
      .filter((m: any) => m.question && m.outcomePrices)
      .slice(0, 12)
      .map((m: any) => {
        // outcomePrices can be a JSON string or an array
        let prices: any[] = [];
        try {
          prices = typeof m.outcomePrices === 'string'
            ? JSON.parse(m.outcomePrices)
            : Array.isArray(m.outcomePrices) ? m.outcomePrices : [];
        } catch { prices = []; }
        const yesProb = prices.length >= 1 ? Number(prices[0]) : NaN;
        return {
          question: m.question as string,
          yesOdds: !isNaN(yesProb) ? `${(yesProb * 100).toFixed(0)}%` : 'N/A',
          volume: Number(m.volume24hr) > 1000 ? `${(Number(m.volume24hr) / 1000).toFixed(0)}K` : String(Math.round(Number(m.volume24hr || 0))),
          category: (m.category as string) ?? 'General',
        };
      });
    trendingCache = { data: markets, ts: Date.now() };
    return markets;
  } catch {
    // Return curated fallback — always works
    trendingCache = { data: FALLBACK_TRENDING, ts: Date.now() };
    return FALLBACK_TRENDING;
  }
}

function formatTrending(markets: typeof FALLBACK_TRENDING) {
  return markets;
}

function formatTrendingMessage(markets: typeof FALLBACK_TRENDING): string {
  if (!markets.length) {
    return '📊 No active prediction markets found right now. Try again in a moment.';
  }
  let msg = `🔥 **Trending Prediction Markets** — Live from Polymarket\n\n`;
  markets.forEach((m, i) => {
    msg += `**${i + 1}. ${m.question}**\n`;
    msg += `   ✅ YES ${m.yesOdds} · 💰 $${m.volume} 24h vol · 🏷 ${m.category}\n\n`;
  });
  msg += `_Ask me about any of these, or say "bet YES on #3" to place a bet!_`;
  return msg;
}

function buildOfflineReply(
  lastUserMsg: string,
  context: {
    isConnected?: boolean;
    address?: string;
    chainId?: number;
    chainName?: string;
    ethBalance?: string;
    activeMarkets?: number;
    totalVolume?: number;
  } | undefined,
  trendingMarkets: typeof FALLBACK_TRENDING,
): string {
  if (lastUserMsg.includes('trend') || lastUserMsg.includes('market')) {
    return formatTrendingMessage(trendingMarkets);
  }

  if (lastUserMsg.includes('sentiment') || lastUserMsg.includes('pumpscore')) {
    return `📈 **Protocol sentiment snapshot**\n\nActive markets: ${context?.activeMarkets ?? 0}\nTotal volume: ${context?.totalVolume ?? 0} ETH\nWallet connected: ${context?.isConnected ? 'Yes' : 'No'}\n\nYou can open /analytics for the live market dashboard or ask me for trending markets.`;
  }

  if (lastUserMsg.includes('portfolio') || lastUserMsg.includes('wallet')) {
    return `📁 **Wallet summary**\n\nWallet connected: ${context?.isConnected ? 'Yes' : 'No'}\nAddress: ${context?.address ?? 'Not connected'}\nChain: ${context?.chainName ?? 'Unknown'}\nBalance: ${context?.ethBalance ?? '0'} ETH\n\nConnect your wallet on the assistant page to unlock portfolio actions.`;
  }

  if (lastUserMsg.includes('voice') || lastUserMsg.includes('speak')) {
    return '🎙 Voice input is ready. Use the microphone button to dictate a command, then I will respond here and speak the reply aloud when supported by your browser.';
  }

  return 'AI is running in offline mode right now. You can still use trending markets, portfolio checks, sentiment summaries, and voice input from this assistant page.';
}

// Rate limit tracking (per-IP, simple in-memory)
const ipRequestCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

function checkApiRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT.windowMs) {
    ipRequestCounts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT.maxRequests) return false;
  entry.count++;
  return true;
}

// ── Fallback: parse function call from plain text ──────

function tryParseFunctionCallFromText(text: string): { name: string; arguments: string } | null {
  try {
    // Try to find JSON object with "name" field
    const jsonMatch = text.match(/\{[\s\S]*?"name"[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.name && FUNCTION_NAMES.includes(parsed.name)) {
      // Ensure arguments is always a plain object before serializing
      let args = parsed.arguments || parsed.params || {};
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        args = {};
      }
      return {
        name: parsed.name,
        arguments: JSON.stringify(args),
      };
    }
  } catch { }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit
  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown');
  if (!checkApiRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limited. Please wait before sending more messages.' });
  }

  const apiKey = process.env.REDPILL_API_KEY || process.env.OPENAI_API_KEY;

  const apiUrl = process.env.AI_API_URL || 'https://api.red-pill.ai/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o';

  try {
    const { messages, context } = req.body as {
      messages: AIRequestMessage[];
      context?: {
        isConnected?: boolean;
        address?: string;
        chainId?: number;
        chainName?: string;
        ethBalance?: string;
        activeMarkets?: number;
        totalVolume?: number;
      };
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.toLowerCase() ?? '';

    // Build system prompt with wallet context + live trending markets
    const trendingMarkets = await fetchTrendingForContext();
    const systemPrompt = buildSystemPrompt({
      isConnected: context?.isConnected || false,
      userAddress: context?.address,
      chainId: context?.chainId,
      chainName: context?.chainName,
      ethBalance: context?.ethBalance,
      activeMarkets: context?.activeMarkets,
      totalVolume: context?.totalVolume,
      trendingMarkets,
    });

    // Filter conversation history — keep last 10 user/assistant messages
    const cleanHistory = messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.function_call))
      .slice(-10);

    // ── Keyword shortcut: bypass AI for trending markets query ──
    // If the user's last message is clearly asking for markets, serve live data immediately
    const TRENDING_KEYWORDS = ['show trending market', 'trending prediction', 'show me markets', 'list market', 'live market', 'what can i bet on', 'show active market', 'top market', 'popular market'];
    const isTrendingQuery = TRENDING_KEYWORDS.some(kw => lastUserMsg.includes(kw));

    if (isTrendingQuery) {
      const formatTrendingMessage = (t: typeof trendingMarkets) => {
        if (!t.length) return '📊 No prediction markets available right now. Try again in a moment.';
        let msg = `🔥 **Trending Prediction Markets** — Live from Polymarket\n\n`;
        t.forEach((m, i) => {
          msg += `**${i + 1}. ${m.question}**\n   ✅ YES ${m.yesOdds} · 💰 $${m.volume} 24h vol · 🏷 ${m.category}\n\n`;
        });
        msg += `_Ask me about any of these to get analysis, or say "I want to bet on #2" to place a bet!_`;
        return msg;
      };
      return res.status(200).json({ type: 'message', message: formatTrendingMessage(trendingMarkets) } as AIResponse);
    }

    if (!apiKey) {
      return res.status(200).json({
        type: 'message',
        message: buildOfflineReply(lastUserMsg, context, trendingMarkets),
      } as AIResponse);
    }

    const apiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...cleanHistory,
    ];


    // First attempt: with function calling
    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1000,
        tools: availableFunctions.map((fn: any) => ({
          type: 'function' as const,
          function: fn,
        })),
        tool_choice: 'auto',
      }),
    });

    let data = await response.json();

    // If tools not supported, retry without it
    if (data.error) {
      console.error('AI API first attempt error:', JSON.stringify(data.error));
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });
      data = await response.json();
    }

    if (!data.choices?.[0]?.message) {
      console.error('AI API error:', JSON.stringify(data));
      return res.status(200).json({
        type: 'message',
        message: buildOfflineReply(lastUserMsg, context, trendingMarkets),
      } as AIResponse);
    }

    const aiMessage = data.choices[0].message;

    // Server-side intercept: handle read-only functions without round-tripping to client
    const getToolName = (msg: typeof aiMessage): string | null => {
      if (msg.tool_calls?.[0]) return msg.tool_calls[0].function.name;
      if (msg.function_call) return msg.function_call.name;
      return null;
    };
    const getToolArgs = (msg: typeof aiMessage): Record<string, unknown> => {
      try {
        const raw = msg.tool_calls?.[0]?.function?.arguments ?? msg.function_call?.arguments ?? '{}';
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return parsed;
      } catch { return {}; }
    };

    const toolName = getToolName(aiMessage);

    // Intercept show_trending_markets — resolve with live Polymarket data server-side
    if (toolName === 'show_trending_markets') {
      const args = getToolArgs(aiMessage);
      let trending = trendingMarkets; // already fetched above
      if (args.query && typeof args.query === 'string') {
        const q = args.query.toLowerCase();
        trending = trending.filter(m => m.question.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
      }
      if (args.category && typeof args.category === 'string' && args.category !== 'all') {
        const cat = args.category.toLowerCase();
        trending = trending.filter(m => m.category.toLowerCase().includes(cat));
      }
      return res.status(200).json({ type: 'message', message: formatTrendingMessage(trending) } as AIResponse);
    }

    // Case 1: Tool call (modern format) — pass to client for confirmation flow
    if (aiMessage.tool_calls?.[0]) {
      const toolCall = aiMessage.tool_calls[0];
      const result: AIResponse = {
        type: 'function_call',
        function_call: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      };
      return res.status(200).json(result);
    }

    // Case 1b: Legacy function_call format
    if (aiMessage.function_call) {
      const result: AIResponse = {
        type: 'function_call',
        function_call: {
          name: aiMessage.function_call.name,
          arguments: aiMessage.function_call.arguments,
        },
      };
      return res.status(200).json(result);
    }

    // Case 2: Text response — check for embedded function call JSON
    const textContent = aiMessage.content || '';
    const embeddedCall = tryParseFunctionCallFromText(textContent);

    if (embeddedCall) {
      const result: AIResponse = {
        type: 'function_call',
        function_call: embeddedCall,
      };
      return res.status(200).json(result);
    }

    // Case 3: Plain text message
    const result: AIResponse = {
      type: 'message',
      message: textContent,
    };
    return res.status(200).json(result);

  } catch (error: any) {
    console.error('AI chat error:', error);
    const body = req.body as {
      messages?: AIRequestMessage[];
      context?: {
        isConnected?: boolean;
        address?: string;
        chainId?: number;
        chainName?: string;
        ethBalance?: string;
        activeMarkets?: number;
        totalVolume?: number;
      };
    };
    const lastUserMsg = body.messages?.filter(m => m.role === 'user').slice(-1)[0]?.content?.toLowerCase() ?? '';
    const trendingMarkets = await fetchTrendingForContext();
    return res.status(200).json({
      type: 'message',
      message: buildOfflineReply(lastUserMsg, body.context, trendingMarkets),
    } as AIResponse);
  }
}
