/**
 * GET /api/auth/me
 * Returns current session user info including profile status.
 * Resilient to DB failures — returns session-only data when Supabase is unreachable.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '../../../server/session';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';
import { prisma } from '../../../server/db';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);

  if (!session.isLoggedIn || !session.address) {
    return res.status(200).json({ isLoggedIn: false });
  }

  // Try DB lookup for full profile data
  try {
    // Use raw query approach to avoid Prisma type issues with profile relation
    const user = await prisma.user.findUnique({
      where: { address: session.address },
    });

    if (!user) {
      // User not in DB — session is valid but no DB record (DB was down during verify)
      return res.status(200).json({
        isLoggedIn: true,
        address: session.address,
        role: 'USER',
        hasProfile: false,
        username: null,
        avatarUrl: null,
        bio: null,
        chainId: session.chainId,
      });
    }

    // Check for profile separately
    let profile: { username: string; avatarUrl: string | null; bio: string | null } | null = null;
    try {
      profile = await prisma.userProfile.findUnique({
        where: { address: session.address },
        select: { username: true, avatarUrl: true, bio: true },
      });
    } catch { /* profile table might not exist */ }

    return res.status(200).json({
      isLoggedIn: true,
      address: user.address,
      role: user.role,
      hasProfile: !!profile,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      bio: profile?.bio ?? null,
      createdAt: user.createdAt,
      lastSeen: user.updatedAt,
      chainId: session.chainId,
    });
  } catch (dbError) {
    // DB unreachable — return session-only data
    console.warn('[auth:me] DB unreachable, returning session-only data:', (dbError as Error).message);
    return res.status(200).json({
      isLoggedIn: true,
      address: session.address,
      role: 'USER',
      hasProfile: false,
      username: null,
      avatarUrl: null,
      bio: null,
      chainId: session.chainId,
      dbOffline: true,
    });
  }
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
