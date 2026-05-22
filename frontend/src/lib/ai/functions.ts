/**
 * PumpX AI Layer — Function Registry
 *
 * Maps natural language AI function calls to PumpX smart contract operations.
 * Each function has:
 *   1. Schema   — OpenAI function-calling format for the LLM
 *   2. Prepare  — Validate params, return confirmation preview
 *   3. Execute  — Actual on-chain transaction (only after user confirms)
 *
 * Functions:
 *   - create_market     → Factory.createMarket()
 *   - place_bet         → Market.depositYes() / depositNo()
 *   - resolve_market    → Market.resolve()
 *   - check_market_status  → Read-only on-chain query
 *   - check_user_portfolio → Read localStorage + on-chain
 *   - show_trending_markets → Read localStorage analytics
 *   - show_sentiment_index  → Compute from market pools
 */

import type {
  AIFunctionSchema,
  FunctionCallResult,
  FunctionExecutionContext,
  ActionSummary,
} from './types';
import type { Market } from '../../types/market';
import {
  FACTORY_ADDRESS,
  MARKET_FACTORY_ABI,
  MILESTONE_MARKET_ABI,
} from '../../constants/contracts';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import { validateFunctionParams, getTransactionRiskLevel } from './security';

// ── Function Schemas (for the LLM) ────────────────────

export const createMarketFunction: AIFunctionSchema = {
  name: 'create_market',
  description:
    'Create a new prediction market on PumpX. Deploys a MilestoneMarket contract where users can bet YES/NO on whether a token reaches a supply threshold by a deadline.',
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The prediction question, e.g. "Will Tesla reach $250 by April?"',
      },
      tokenAddress: {
        type: 'string',
        description: 'The token or asset identifier. Can be an ERC-20 contract address (0x...) or a stock/crypto ticker symbol like TSLA, BTC, ETH, PEPE',
      },
      threshold: {
        type: 'number',
        description: 'The supply threshold the token must reach',
      },
      deadline: {
        type: 'string',
        description: 'When the market expires. Can be a date like "2026-04-30" or relative like "30 days"',
      },
    },
    required: ['question', 'tokenAddress', 'threshold', 'deadline'],
  },
};

export const placeBetFunction: AIFunctionSchema = {
  name: 'place_bet',
  description:
    'Place a YES or NO bet on an existing prediction market. Sends ETH to the market contract.',
  parameters: {
    type: 'object',
    properties: {
      marketAddress: {
        type: 'string',
        description: 'The market contract address to bet on',
      },
      side: {
        type: 'string',
        description: 'The side to bet on',
        enum: ['YES', 'NO'],
      },
      amount: {
        type: 'number',
        description: 'Amount of ETH to bet',
      },
    },
    required: ['marketAddress', 'side', 'amount'],
  },
};

export const resolveMarketFunction: AIFunctionSchema = {
  name: 'resolve_market',
  description:
    'Resolve a prediction market after its deadline has passed. Only the market creator can call this.',
  parameters: {
    type: 'object',
    properties: {
      marketAddress: {
        type: 'string',
        description: 'The market contract address to resolve',
      },
    },
    required: ['marketAddress'],
  },
};

export const checkMarketStatusFunction: AIFunctionSchema = {
  name: 'check_market_status',
  description:
    'Check the current status of a prediction market — pools, deadline, resolution status, and odds.',
  parameters: {
    type: 'object',
    properties: {
      marketAddress: {
        type: 'string',
        description: 'The market contract address to check',
      },
    },
    required: ['marketAddress'],
  },
};

export const checkUserPortfolioFunction: AIFunctionSchema = {
  name: 'check_user_portfolio',
  description:
    'Show the current user\'s prediction market portfolio — their bets, positions, and P&L across all markets.',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Optional wallet address. If not provided, uses the connected wallet.',
      },
    },
    required: [],
  },
};

export const showTrendingMarketsFunction: AIFunctionSchema = {
  name: 'show_trending_markets',
  description:
    'Show live trending prediction markets from Polymarket and PumpX. ONLY call this when the user EXPLICITLY asks to see markets, e.g. "show trending markets", "what markets are hot", "what can I bet on". Do NOT call this for greetings, general questions, or conversations.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Optional search query to filter markets, e.g. "bitcoin", "election", "FIFA"',
      },
      category: {
        type: 'string',
        description: 'Optional category filter: Politics, Crypto, Sports, Science, Entertainment, Economics',
      },
    },
    required: [],
  },
};

export const showSentimentIndexFunction: AIFunctionSchema = {
  name: 'show_sentiment_index',
  description:
    'Show market sentiment — the ratio of YES to NO bets across markets, optionally filtered by a stock ticker.',
  parameters: {
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Optional stock ticker to filter by, e.g. "TSLA"',
      },
    },
    required: [],
  },
};

// ── Registry ───────────────────────────────────────────

export const availableFunctions: AIFunctionSchema[] = [
  createMarketFunction,
  placeBetFunction,
  resolveMarketFunction,
  checkMarketStatusFunction,
  checkUserPortfolioFunction,
  showTrendingMarketsFunction,
  showSentimentIndexFunction,
];

export const FUNCTION_NAMES = availableFunctions.map(f => f.name);

// ── Prepare Functions (validate + build preview) ───────

function getMarketsFromStorage(): Market[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('prediction-markets') || '[]');
  } catch {
    return [];
  }
}

function findMarketByAddress(address: string): Market | undefined {
  return getMarketsFromStorage().find(
    m => m.marketContract?.toLowerCase() === address.toLowerCase()
  );
}

export function prepareCreateMarket(
  params: Record<string, unknown>,
  userAddress?: string
): FunctionCallResult {
  if (!userAddress) {
    return { success: false, type: 'create_market', status: 'error', needsWallet: true, error: 'Connect your wallet first' };
  }

  const validation = validateFunctionParams('create_market', params);
  if (!validation.isValid) {
    return { success: false, type: 'create_market', status: 'error', error: validation.errors.join('; '), missing: validation.errors };
  }

  const { question, tokenAddress, threshold, deadline } = validation.sanitized as {
    question: string; tokenAddress: string; threshold: number; deadline: number;
  };

  const deadlineDate = new Date(deadline);
  const risk = getTransactionRiskLevel('create_market', validation.sanitized);

  const summary: ActionSummary[] = [
    { label: 'Action', value: 'Create Prediction Market' },
    { label: 'Question', value: question, highlight: true },
    { label: 'Token', value: tokenAddress },
    { label: 'Threshold', value: threshold.toLocaleString() },
    { label: 'Deadline', value: deadlineDate.toLocaleDateString() },
    { label: 'Risk Level', value: risk.toUpperCase() },
  ];

  return {
    success: true,
    type: 'create_market',
    status: 'pending_confirmation',
    displayName: 'Create Market',
    data: validation.sanitized,
    summary,
  };
}

export function preparePlaceBet(
  params: Record<string, unknown>,
  userAddress?: string
): FunctionCallResult {
  if (!userAddress) {
    return { success: false, type: 'place_bet', status: 'error', needsWallet: true, error: 'Connect your wallet first' };
  }

  const validation = validateFunctionParams('place_bet', params);
  if (!validation.isValid) {
    return { success: false, type: 'place_bet', status: 'error', error: validation.errors.join('; ') };
  }

  const { marketAddress, side, amount } = validation.sanitized as {
    marketAddress: string; side: string; amount: number;
  };

  const market = findMarketByAddress(marketAddress);
  const risk = getTransactionRiskLevel('place_bet', validation.sanitized);

  const summary: ActionSummary[] = [
    { label: 'Action', value: `Bet ${side}`, highlight: true },
    { label: 'Amount', value: `${amount} ETH`, highlight: true },
    { label: 'Market', value: market?.question || marketAddress },
    { label: 'Contract', value: marketAddress },
    { label: 'Risk Level', value: risk.toUpperCase() },
  ];

  if (validation.warnings.length > 0) {
    summary.push({ label: '⚠️ Warning', value: validation.warnings.join('; '), highlight: true });
  }

  return {
    success: true,
    type: 'place_bet',
    status: 'pending_confirmation',
    displayName: `Bet ${amount} ETH on ${side}`,
    data: validation.sanitized,
    summary,
  };
}

export function prepareResolveMarket(
  params: Record<string, unknown>,
  userAddress?: string
): FunctionCallResult {
  if (!userAddress) {
    return { success: false, type: 'resolve_market', status: 'error', needsWallet: true, error: 'Connect your wallet first' };
  }

  const validation = validateFunctionParams('resolve_market', params);
  if (!validation.isValid) {
    return { success: false, type: 'resolve_market', status: 'error', error: validation.errors.join('; ') };
  }

  const { marketAddress } = validation.sanitized as { marketAddress: string };
  const market = findMarketByAddress(marketAddress);

  const summary: ActionSummary[] = [
    { label: 'Action', value: 'Resolve Market', highlight: true },
    { label: 'Market', value: market?.question || marketAddress },
    { label: 'Contract', value: marketAddress },
    { label: '⚠️ Warning', value: 'This action is irreversible', highlight: true },
  ];

  return {
    success: true,
    type: 'resolve_market',
    status: 'pending_confirmation',
    displayName: 'Resolve Market',
    data: validation.sanitized,
    summary,
  };
}

// ── Read-Only Functions (no confirmation needed) ───────

export function executeCheckMarketStatus(
  params: Record<string, unknown>
): FunctionCallResult {
  const validation = validateFunctionParams('check_market_status', params);
  if (!validation.isValid) {
    return { success: false, type: 'check_market_status', status: 'error', error: validation.errors.join('; ') };
  }

  const { marketAddress } = validation.sanitized as { marketAddress: string };
  const market = findMarketByAddress(marketAddress);

  if (!market) {
    return {
      success: true,
      type: 'check_market_status',
      status: 'ready',
      data: { marketAddress, found: false, message: 'Market not found in local registry. It may exist on-chain but is not tracked locally.' },
    };
  }

  const totalPool = market.yesPool + market.noPool;
  const yesOdds = totalPool > 0 ? ((market.yesPool / totalPool) * 100).toFixed(1) : '50.0';
  const noOdds = totalPool > 0 ? ((market.noPool / totalPool) * 100).toFixed(1) : '50.0';
  const isActive = !market.resolved && market.deadline > Date.now();

  return {
    success: true,
    type: 'check_market_status',
    status: 'ready',
    data: {
      question: market.question,
      marketAddress: market.marketContract,
      status: market.resolved ? (market.reached ? 'REACHED' : 'FAILED') : isActive ? 'ACTIVE' : 'EXPIRED',
      yesPool: market.yesPool,
      noPool: market.noPool,
      totalPool,
      yesOdds: `${yesOdds}%`,
      noOdds: `${noOdds}%`,
      deadline: new Date(market.deadline).toISOString(),
      betsCount: market.bets.length,
      stockTicker: market.stockTicker || null,
    },
  };
}

export function executeCheckPortfolio(
  params: Record<string, unknown>,
  userAddress?: string
): FunctionCallResult {
  const address = (params.address as string || userAddress || '').toLowerCase();
  if (!address) {
    return { success: false, type: 'check_user_portfolio', status: 'error', needsWallet: true, error: 'No address provided and wallet not connected' };
  }

  const markets = getMarketsFromStorage();
  const positions = markets
    .map(m => {
      const userBets = m.bets.filter(b => b.address.toLowerCase() === address);
      if (userBets.length === 0) return null;

      const yesTotal = userBets.filter(b => b.side === 'YES').reduce((s, b) => s + b.amount, 0);
      const noTotal = userBets.filter(b => b.side === 'NO').reduce((s, b) => s + b.amount, 0);

      return {
        market: m.question,
        marketAddress: m.marketContract,
        yesPosition: yesTotal,
        noPosition: noTotal,
        totalInvested: yesTotal + noTotal,
        resolved: m.resolved,
        outcome: m.resolved ? (m.reached ? 'REACHED' : 'FAILED') : 'PENDING',
      };
    })
    .filter(Boolean);

  const totalInvested = positions.reduce((s, p) => s + (p?.totalInvested || 0), 0);

  return {
    success: true,
    type: 'check_user_portfolio',
    status: 'ready',
    data: {
      address,
      positions,
      totalInvested,
      marketsCount: positions.length,
    },
  };
}

export function executeShowTrending(params: Record<string, unknown> = {}): FunctionCallResult {
  const query = typeof params.query === 'string' ? params.query : undefined;
  const category = typeof params.category === 'string' ? params.category : undefined;

  // Return a signal for the client-side hook to fetch real data from the API
  // The useAI hook will detect this and call /api/markets/trending
  return {
    success: true,
    type: 'show_trending_markets',
    status: 'ready',
    data: {
      __fetchFromApi: true,
      query,
      category,
      message: 'Fetching live markets from Polymarket...',
    },
  };
}

export function executeShowSentiment(params: Record<string, unknown>): FunctionCallResult {
  const ticker = typeof params.ticker === 'string' ? params.ticker.toUpperCase() : null;
  const markets = getMarketsFromStorage();

  const filtered = ticker
    ? markets.filter(m => m.stockTicker?.toUpperCase() === ticker)
    : markets;

  const active = filtered.filter(m => !m.resolved);
  const totalYes = active.reduce((s, m) => s + m.yesPool, 0);
  const totalNo = active.reduce((s, m) => s + m.noPool, 0);
  const total = totalYes + totalNo;

  return {
    success: true,
    type: 'show_sentiment_index',
    status: 'ready',
    data: {
      ticker: ticker || 'ALL',
      bullish: total > 0 ? `${((totalYes / total) * 100).toFixed(1)}%` : '50%',
      bearish: total > 0 ? `${((totalNo / total) * 100).toFixed(1)}%` : '50%',
      totalVolume: total,
      activeMarkets: active.length,
      marketBreakdown: active.slice(0, 5).map(m => ({
        question: m.question,
        yesWeight: m.yesPool,
        noWeight: m.noPool,
      })),
    },
  };
}

// ── Central Dispatcher ─────────────────────────────────

type PrepareFn = (params: Record<string, unknown>, userAddress?: string) => FunctionCallResult;

const preparers: Record<string, PrepareFn> = {
  create_market: prepareCreateMarket,
  place_bet: preparePlaceBet,
  resolve_market: prepareResolveMarket,
  check_market_status: executeCheckMarketStatus,
  check_user_portfolio: executeCheckPortfolio,
  show_trending_markets: (params) => executeShowTrending(params),
  show_sentiment_index: executeShowSentiment,
};

export function executeFunction(
  functionName: string,
  args: Record<string, unknown>,
  userAddress?: string
): FunctionCallResult {
  const preparer = preparers[functionName];
  if (!preparer) {
    return { success: false, type: functionName, status: 'error', error: `Unknown function: ${functionName}` };
  }
  return preparer(args, userAddress);
}

// ── On-Chain Executors (called after user confirms) ────

export async function executeCreateMarketOnChain(
  params: Record<string, unknown>,
  ctx: FunctionExecutionContext
): Promise<{ success: boolean; hash?: string; marketAddress?: string; error?: string }> {
  try {
    const tokenAddress = params.tokenAddress as `0x${string}`;
    const threshold = BigInt(Math.floor((params.threshold as number) * 1e18));
    const deadline = BigInt(Math.floor(((params.deadline as number) - Date.now()) / 1000));
    const currentSupply = BigInt(0); // Will be fetched on-chain

    const hash = await ctx.writeContract({
      address: FACTORY_ADDRESS,
      abi: MARKET_FACTORY_ABI,
      functionName: 'createMarket',
      args: [tokenAddress, threshold, deadline, currentSupply],
    });

    return { success: true, hash };
  } catch (e: any) {
    return { success: false, error: e?.shortMessage || e?.message || 'Transaction failed' };
  }
}

export async function executePlaceBetOnChain(
  params: Record<string, unknown>,
  ctx: FunctionExecutionContext
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const marketAddress = params.marketAddress as `0x${string}`;
    const side = params.side as string;
    const amount = params.amount as number;

    const hash = await ctx.writeContract({
      address: marketAddress,
      abi: MILESTONE_MARKET_ABI,
      functionName: side === 'YES' ? 'depositYes' : 'depositNo',
      value: parseEther(String(amount)),
    });

    return { success: true, hash };
  } catch (e: any) {
    return { success: false, error: e?.shortMessage || e?.message || 'Transaction failed' };
  }
}

export async function executeResolveMarketOnChain(
  params: Record<string, unknown>,
  ctx: FunctionExecutionContext
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    const marketAddress = params.marketAddress as `0x${string}`;

    const hash = await ctx.writeContract({
      address: marketAddress,
      abi: MILESTONE_MARKET_ABI,
      functionName: 'resolve',
    });

    return { success: true, hash };
  } catch (e: any) {
    return { success: false, error: e?.shortMessage || e?.message || 'Transaction failed' };
  }
}

/** Map function names to on-chain executors */
export const onChainExecutors: Record<
  string,
  (params: Record<string, unknown>, ctx: FunctionExecutionContext) => Promise<{ success: boolean; hash?: string; error?: string }>
> = {
  create_market: executeCreateMarketOnChain,
  place_bet: executePlaceBetOnChain,
  resolve_market: executeResolveMarketOnChain,
};

/** Check if a function requires on-chain execution (vs read-only) */
export function requiresOnChainExecution(functionName: string): boolean {
  return functionName in onChainExecutors;
}
