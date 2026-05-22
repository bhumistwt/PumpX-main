/**
 * POST /api/user/profile  — create/update user profile (username, avatar)
 * GET  /api/user/profile  — get current user profile
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import {
    withAuth,
    withErrorHandler,
    withMethod,
    compose,
    type AuthenticatedRequest,
} from '../../../server/middleware';
import { prisma } from '../../../server/db';
import { createLogger } from '../../../server/logger';

const log = createLogger('user:profile');

const createProfileSchema = z.object({
    username: z
        .string()
        .min(3, 'Minimum 3 characters')
        .max(30, 'Maximum 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
    avatarUrl: z.string().url().optional().nullable(),
    bio: z.string().max(200).optional().nullable(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
    const address = req.user!.address;

    if (req.method === 'GET') {
        const profile = await prisma.userProfile.findUnique({
            where: { address },
        });
        return res.status(200).json({ profile });
    }

    // POST — create or update
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
        });
    }

    const { username, avatarUrl, bio } = parsed.data;

    // Check username uniqueness (allow own name)
    const existing = await prisma.userProfile.findUnique({
        where: { username },
    });
    if (existing && existing.address !== address) {
        return res.status(409).json({ error: 'Username already taken' });
    }

    const profile = await prisma.userProfile.upsert({
        where: { address },
        update: { username, avatarUrl: avatarUrl ?? null, bio: bio ?? null },
        create: { address, username, avatarUrl: avatarUrl ?? null, bio: bio ?? null },
    });

    log.info({ address, username }, 'Profile updated');
    return res.status(200).json({ profile });
}

export default compose(
    withErrorHandler,
    withAuth,
)(async (req: AuthenticatedRequest, res: NextApiResponse) => {
    if (!['GET', 'POST'].includes(req.method || '')) {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    return handler(req, res);
});
