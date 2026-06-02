/**
 * POST /api/referrals/track — Record a referral visit (Prisma + Supabase).
 */
import type { NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { supabase } from '../../../lib/supabase';
import {
  withErrorHandler,
  withMethod,
  withSession,
  compose,
  type AuthenticatedRequest,
} from '../../../server/middleware';
import { normalizeAddress } from '../../../server/referrals';
import { isValidEthAddress } from '../../../lib/addresses';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const referrerId = typeof req.body?.referrerId === 'string'
    ? normalizeAddress(req.body.referrerId)
    : '';
  const marketId = typeof req.body?.marketId === 'string'
    ? normalizeAddress(req.body.marketId)
    : '';
  const refereeId = typeof req.body?.refereeId === 'string' && req.body.refereeId
    ? normalizeAddress(req.body.refereeId)
    : req.session?.address
      ? normalizeAddress(req.session.address)
      : null;

  if (!isValidEthAddress(referrerId) || !isValidEthAddress(marketId)) {
    return res.status(400).json({ error: 'Invalid referrer or market address.' });
  }

  if (refereeId && refereeId === referrerId) {
    return res.status(400).json({ error: 'Cannot refer yourself.' });
  }

  const market = await prisma.market.findUnique({
    where: { contractAddress: marketId },
    select: { contractAddress: true },
  });

  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }

  await prisma.user.upsert({
    where: { address: referrerId },
    update: {},
    create: { address: referrerId },
  });

  if (!refereeId) {
    return res.status(200).json({ tracked: false, pending: true });
  }

  if (!isValidEthAddress(refereeId)) {
    return res.status(400).json({ error: 'Invalid referee address.' });
  }

  await prisma.user.upsert({
    where: { address: refereeId },
    update: {},
    create: { address: refereeId },
  });

  const referral = await prisma.referral.upsert({
    where: {
      referrerId_refereeId_marketId: {
        referrerId,
        refereeId,
        marketId,
      },
    },
    update: {},
    create: {
      referrerId,
      refereeId,
      marketId,
    },
    select: {
      id: true,
      referrerId: true,
      refereeId: true,
      marketId: true,
      volumeGenerated: true,
      createdAt: true,
    },
  });

  // Mirror to Supabase (same Postgres; best-effort if table not exposed)
  try {
    await supabase.from('Referral').upsert(
      {
        id: referral.id,
        referrerId: referral.referrerId,
        refereeId: referral.refereeId,
        marketId: referral.marketId,
        volumeGenerated: referral.volumeGenerated,
        createdAt: referral.createdAt.toISOString(),
      },
      { onConflict: 'id' },
    );
  } catch {
    // Supabase client may lack table access; Prisma is source of truth
  }

  return res.status(200).json({ tracked: true, referral });
}

export default compose(
  withErrorHandler,
  withMethod('POST'),
  withSession,
)(handler);
