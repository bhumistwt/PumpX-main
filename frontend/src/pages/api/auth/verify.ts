/**
 * POST /api/auth/verify
 * Verify a signed SIWE message and establish a session.
 * Checks nonce in DB first, then falls back to iron-session nonce.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { SiweMessage } from 'siwe';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '../../../server/session';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';
import { prisma } from '../../../server/db';

const log = createLogger('auth:verify');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { message, signature } = req.body;

  if (!message || typeof message !== 'string' || !signature) {
    return res.status(400).json({ error: 'Missing or invalid message/signature' });
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch {
    return res.status(400).json({ error: 'Invalid SIWE message format' });
  }

  const { nonce, address: rawAddress } = siweMessage;
  if (!nonce || !rawAddress) {
    return res.status(400).json({ error: 'SIWE message missing nonce or address' });
  }

  const address = rawAddress.toLowerCase();

  // ── Nonce validation: try DB first, then session fallback ──
  let nonceValid = false;
  let nonceSource = 'unknown';

  // 1. Check DB nonce
  try {
    const storedNonce = await prisma.authNonce.findUnique({ where: { nonce } });
    if (storedNonce && !storedNonce.used && storedNonce.expiresAt > new Date() && storedNonce.address.toLowerCase() === address) {
      nonceValid = true;
      nonceSource = 'db';
      // Mark as used
      await prisma.authNonce.update({ where: { nonce }, data: { used: true } }).catch(() => { });
    }
  } catch (dbErr) {
    log.warn({ err: dbErr }, 'DB nonce check failed, trying session fallback');
  }

  // 2. Fallback: check iron-session nonce
  if (!nonceValid) {
    try {
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (session.nonce && session.nonce === nonce) {
        nonceValid = true;
        nonceSource = 'session';
        session.nonce = undefined; // Consume it
        await session.save();
      }
    } catch {
      log.warn('Session nonce check also failed');
    }
  }

  if (!nonceValid) {
    return res.status(422).json({ error: 'Invalid or expired nonce. Please sign in again.' });
  }

  // ── Verify SIWE signature ──
  const result = await siweMessage.verify({ signature, nonce });

  if (!result.success) {
    log.warn({ err: result.error, address }, 'SIWE verification failed');
    return res.status(401).json({ error: 'Signature verification failed. Please try again.' });
  }

  const verifiedAddress = result.data.address.toLowerCase();

  // Upsert user in DB (best-effort — if DB is down, skip)
  let userRole = 'USER';
  let hasProfile = false;
  try {
    const user = await prisma.user.upsert({
      where: { address: verifiedAddress },
      update: { updatedAt: new Date() },
      create: { address: verifiedAddress },
    });
    userRole = user.role;
    const profile = await prisma.userProfile.findUnique({ where: { address: verifiedAddress } });
    hasProfile = !!profile;
  } catch (dbErr) {
    log.warn({ err: dbErr }, 'DB user upsert failed — proceeding with session-only auth');
  }

  // Save iron-session
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.address = verifiedAddress;
  session.chainId = result.data.chainId;
  session.isLoggedIn = true;
  session.nonce = undefined;
  await session.save();

  log.info({ address: verifiedAddress, chainId: result.data.chainId, nonceSource }, 'User authenticated');

  return res.status(200).json({
    ok: true,
    address: verifiedAddress,
    chainId: result.data.chainId,
    role: userRole,
    hasProfile,
  });
}

export default compose(withErrorHandler, withMethod('POST'))(handler);
