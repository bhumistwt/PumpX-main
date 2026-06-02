import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeMarket } from '../../../lib/ai/marketAnalysis';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const marketId = String(req.query.marketId || '').toLowerCase();

  if (!marketId || !/^0x[a-f0-9]{40}$/.test(marketId)) {
    return res.status(400).json({ error: 'Invalid marketId' });
  }

  const market = await prisma.market.findUnique({
    where: { contractAddress: marketId },
    select: { tokenAddress: true },
  });

  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  const tokenAddress =
    typeof req.query.tokenAddress === 'string'
      ? req.query.tokenAddress
      : market.tokenAddress;

  try {
    const analysis = await analyzeMarket(marketId, tokenAddress);
    return res.status(200).json({ analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Analysis failed';
    if (msg.includes('unavailable')) {
      return res.status(503).json({ error: 'AI analysis unavailable', analysis: null });
    }
    throw e;
  }
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
