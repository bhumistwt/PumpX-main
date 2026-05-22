/**
 * GET  /api/gamification/streaks?address=0x...  — Get user's streak data
 * POST /api/gamification/streaks                 — Check in for today (auth'd)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';
import { withErrorHandler, withMethod, withAuth, compose, type AuthenticatedRequest } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('api:streaks');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  return handleCheckIn(req as AuthenticatedRequest, res);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid address' });
  }

  const streak = await prisma.streak.findUnique({
    where: { userAddress: address },
  });

  if (!streak) {
    return res.status(200).json({
      address,
      currentStreak: 0,
      longestStreak: 0,
      lastCheckIn: null,
      isCheckedInToday: false,
    });
  }

  const isCheckedInToday = streak.lastActivityDate === todayStr();

  res.status(200).json({
    address,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    lastCheckIn: streak.lastActivityDate,
    isCheckedInToday,
  });
}

async function handleCheckIn(req: AuthenticatedRequest, res: NextApiResponse) {
  const address = req.user!.address;
  const today = todayStr();

  // Helper to get yesterday's date string
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);

  const existing = await prisma.streak.findUnique({
    where: { userAddress: address },
  });

  if (existing) {
    // Already checked in today
    if (existing.lastActivityDate === today) {
      return res.status(200).json({
        message: 'Already checked in today',
        currentStreak: existing.currentStreak,
        longestStreak: existing.longestStreak,
        lastCheckIn: existing.lastActivityDate,
        xpAwarded: 0,
      });
    }

    const isConsecutive = existing.lastActivityDate === yesterday;
    const newStreak = isConsecutive ? existing.currentStreak + 1 : 1;
    const newLongest = Math.max(existing.longestStreak, newStreak);

    const updated = await prisma.streak.update({
      where: { userAddress: address },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: today,
      },
    });

    // Award XP for streak check-in
    const xpAmount = Math.min(10 + newStreak * 2, 50); // 10 base + 2 per streak day, max 50
    await prisma.xPTransaction.create({
      data: {
        userAddress: address,
        amount: xpAmount,
        reason: `Daily check-in (${newStreak}-day streak)`,
      },
    });

    log.info({ address, streak: newStreak, xp: xpAmount }, 'Streak check-in');

    return res.status(200).json({
      currentStreak: updated.currentStreak,
      longestStreak: updated.longestStreak,
      lastCheckIn: updated.lastActivityDate,
      xpAwarded: xpAmount,
    });
  }

  // First check-in ever
  const created = await prisma.streak.create({
    data: {
      userAddress: address,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: today,
    },
  });

  await prisma.xPTransaction.create({
    data: {
      userAddress: address,
      amount: 10,
      reason: 'First daily check-in',
    },
  });

  log.info({ address }, 'First streak check-in');

  res.status(200).json({
    currentStreak: created.currentStreak,
    longestStreak: created.longestStreak,
    lastCheckIn: created.lastActivityDate,
    xpAwarded: 10,
  });
}

export default compose(withErrorHandler, withMethod('GET', 'POST'))(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'POST') {
      return withAuth(handleCheckIn)(req as any, res);
    }
    return handleGet(req, res);
  }
);
