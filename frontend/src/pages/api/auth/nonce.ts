/**
 * POST /api/auth/nonce
 * Generates a cryptographic nonce for SIWE.
 * Primary: stores in DB (AuthNonce table) with 5-min expiry.
 * Fallback: stores in iron-session if DB is unreachable.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import crypto from 'crypto';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '../../../server/session';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('auth:nonce');

const bodySchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid address', details: parsed.error.flatten().fieldErrors });
  }

  const { address } = parsed.data;
  const normalizedAddress = address.toLowerCase();
  const nonce = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Try DB storage first
  let storedInDb = false;
  try {
    // Housekeeping: clean expired nonces
    await prisma.authNonce.deleteMany({
      where: { address: normalizedAddress, expiresAt: { lt: new Date() } },
    }).catch(() => { });

    await prisma.authNonce.create({
      data: { nonce, address: normalizedAddress, expiresAt },
    });
    storedInDb = true;
    log.debug({ address: normalizedAddress }, 'Nonce issued (DB)');
  } catch (dbErr) {
    // DB unreachable — fall back to iron-session
    log.warn({ err: dbErr }, 'DB unreachable, falling back to session nonce');
  }

  // Fallback: store nonce in iron-session
  if (!storedInDb) {
    try {
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      session.nonce = nonce;
      await session.save();
      log.debug({ address: normalizedAddress }, 'Nonce issued (session fallback)');
    } catch (sessErr) {
      log.error({ err: sessErr }, 'Both DB and session nonce storage failed');
      return res.status(500).json({ error: 'Failed to generate nonce. Please try again.' });
    }
  }

  return res.status(200).json({ nonce, storage: storedInDb ? 'db' : 'session' });
}

export default compose(withErrorHandler, withMethod('POST'))(handler);
