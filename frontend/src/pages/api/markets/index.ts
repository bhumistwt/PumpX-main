/**
 * GET  /api/markets   — List all markets (with pagination & filters)
 * POST /api/markets   — Register a newly deployed market into the DB
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { createLogger } from '../../../server/logger';
import { mlClient } from '../../../lib/mlClient';
import {
  withErrorHandler,
  withMethod,
  withAuth,
  compose,
  type AuthenticatedRequest,
} from '../../../server/middleware';

const log = createLogger('api:markets');

// ── GET /api/markets ─────────────────────────────────────
async function handleList(req: NextApiRequest, res: NextApiResponse) {
  const {
    status,
    chainId,
    creator,
    page = '1',
    limit = '20',
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = {};
  if (chainId) where.chainId = parseInt(chainId);
  if (creator) where.creatorAddress = creator.toLowerCase();
  if (status === 'active') {
    where.resolved = false;
    where.deadline = { gt: new Date() };
  } else if (status === 'resolved') {
    where.resolved = true;
  }

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      include: { _count: { select: { bets: true } } },
    }),
    prisma.market.count({ where }),
  ]);

  return res.status(200).json({
    markets,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
}

// ── POST /api/markets ────────────────────────────────────
// Called after an on-chain MarketCreated event is confirmed.
// Upserts the market (create or update question if already indexed).
async function handleCreate(req: AuthenticatedRequest, res: NextApiResponse) {
  const {
    contractAddress,
    chainId,
    tokenAddress,
    question,
    threshold,
    deadline,
    initialSupply,
    txHash,
    blockNumber,
    stockTicker,
  } = req.body as {
    contractAddress: string;
    chainId: number;
    tokenAddress: string;
    question: string;
    threshold: string;
    deadline: string;
    initialSupply: string;
    txHash: string;
    blockNumber: number;
    stockTicker?: string;
  };

  const addr = contractAddress.toLowerCase();
  const token = tokenAddress.toLowerCase();
  const creator = req.user!.address.toLowerCase();

  // Ensure creator user record exists
  await prisma.user.upsert({
    where: { address: creator },
    update: {},
    create: { address: creator },
  });

  // ── Step 1: Upsert the Market record ─────────────────────
  const market = await prisma.market.upsert({
    where: { contractAddress: addr },
    update: { question, stockTicker: stockTicker ?? null },
    create: {
      contractAddress: addr,
      chainId,
      creatorAddress: creator,
      tokenAddress: token,
      question,
      threshold,
      deadline: new Date(deadline),
      initialSupply,
      latestSupply: initialSupply,
      txHash,
      blockNumber,
      stockTicker: stockTicker ?? null,
    },
  });

  log.info({ market: addr, chainId, question }, 'Market registered');

  // ── Step 2: Generate ML baseline probability (non-blocking) ──
  // Runs after market is already registered — failure never blocks creation.
  try {
    const mlResult = await mlClient.predict({
      symbol: stockTicker ?? 'UNKNOWN',
      market: 'US',
      date: new Date().toISOString().slice(0, 10),
    });

    // fair_price = probability * 100 — used to seed AMM initial price
    const fairPrice = mlResult.probability * 100;

    // Persist baseline fields (Prisma client updated after prisma generate)
    await prisma.market.update({
      where: { contractAddress: addr },
      data: {
        modelBaselineProbability: mlResult.probability,
        modelConfidence: mlResult.confidence,
        modelSignal: mlResult.signal,
        modelRiskFlags: mlResult.risk_flags,
      },
    });

    // Log prediction event
    await prisma.modelPredictionLog.create({
      data: {
        marketAddress: addr,
        probability: mlResult.probability,
        confidence: mlResult.confidence,
        signal: mlResult.signal,
        riskFlags: mlResult.risk_flags,
        triggeredBy: 'CREATION',
        rawScore: mlResult.raw_score,
      },
    });

    log.info(
      { market: addr, prob: mlResult.probability, signal: mlResult.signal, fairPrice },
      'ML baseline stored at market creation'
    );

    return res.status(200).json({
      market: {
        ...market,
        modelBaselineProbability: mlResult.probability,
        modelConfidence: mlResult.confidence,
        modelSignal: mlResult.signal,
        modelRiskFlags: mlResult.risk_flags,
        fairPrice,
      },
    });
  } catch (mlErr) {
    // ML failure is non-fatal — market is already created
    log.warn({ err: mlErr, market: addr }, 'ML baseline skipped (model unavailable)');
    return res.status(200).json({ market });
  }
}

async function routeHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return withAuth(handleCreate)(req as AuthenticatedRequest, res);
  }
  return handleList(req, res);
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(routeHandler);
