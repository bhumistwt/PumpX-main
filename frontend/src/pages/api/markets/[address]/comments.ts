import type { NextApiResponse } from 'next';
import { prisma } from '../../../../server/db';
import {
  withErrorHandler,
  withAuth,
  withMethod,
  compose,
  type AuthenticatedRequest,
} from '../../../../server/middleware';
import { normalizeAddress } from '../../../../server/referrals';

async function getHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const marketId = normalizeAddress(String(req.query.address));

  const market = await prisma.market.findUnique({
    where: { contractAddress: marketId },
    select: { contractAddress: true },
  });

  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  const comments = await prisma.comment.findMany({
    where: { marketId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      marketId: true,
      walletAddress: true,
      content: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ comments });
}

async function postHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const marketId = normalizeAddress(String(req.query.address));
  const walletAddress = req.user!.address;
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  if (!content || content.length > 1000) {
    return res.status(400).json({ error: 'Comment must be 1–1000 characters.' });
  }

  const market = await prisma.market.findUnique({
    where: { contractAddress: marketId },
    select: { contractAddress: true },
  });

  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  const comment = await prisma.comment.create({
    data: {
      marketId,
      walletAddress,
      content,
    },
    select: {
      id: true,
      marketId: true,
      walletAddress: true,
      content: true,
      createdAt: true,
    },
  });

  return res.status(201).json({ comment });
}

export default compose(
  withErrorHandler,
  withMethod('GET', 'POST'),
)(async (req, res) => {
  if (req.method === 'GET') return getHandler(req, res);
  return withAuth(postHandler)(req, res);
});
