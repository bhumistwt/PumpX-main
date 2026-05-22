/**
 * PumpX — API Middleware (iron-session v8)
 *
 * Reusable middleware for Next.js API routes:
 * - withAuth: requires SIWE session
 * - withRole: requires specific role
 * - withRateLimit: in-memory rate limiting
 * - withValidation: Zod schema validation
 * - withErrorHandler: structured error responses
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './session';
import { prisma } from './db';
import { createLogger } from './logger';
import type { ZodSchema } from 'zod';

const log = createLogger('middleware');

// ── Types ────────────────────────────────────────────────

export interface AuthenticatedRequest extends NextApiRequest {
  session: SessionData & {
    save: () => Promise<void>;
    destroy: () => void;
  };
  user?: {
    address: string;
    role: string;
  };
}

type ApiHandler = (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void;

// ── Session Resolver ─────────────────────────────────────

async function resolveSession(req: NextApiRequest, res: NextApiResponse): Promise<SessionData & { save: () => Promise<void>; destroy: () => void }> {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  return session as any;
}

// ── Error Handler Wrapper ────────────────────────────────

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const stack = error instanceof Error ? error.stack : undefined;

      log.error({ err: error, method: req.method, url: req.url }, 'Unhandled API error');

      // Never leak stack traces to client in production
      res.status(500).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack }),
      });
    }
  };
}

// ── Authentication Middleware ─────────────────────────────

export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res) => {
    const session = await resolveSession(req, res);
    (req as any).session = session;

    if (!session.isLoggedIn || !session.address) {
      return res.status(401).json({ error: 'Authentication required. Sign in with your wallet.' });
    }

    // Attach user from DB (creates if not exists)
    const user = await prisma.user.upsert({
      where: { address: session.address },
      update: {},
      create: { address: session.address },
      select: { address: true, role: true },
    });

    req.user = user;
    return handler(req, res);
  };
}

// ── Role-based Authorization ─────────────────────────────

export function withRole(...roles: string[]) {
  return function (handler: ApiHandler): ApiHandler {
    return withAuth(async (req, res) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions.' });
      }
      return handler(req, res);
    });
  };
}

// ── Session Wrapper (no auth required, just session access) ─

export function withSession(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res) => {
    const session = await resolveSession(req, res);
    (req as any).session = session;
    return handler(req, res);
  };
}

// ── Zod Validation Middleware ────────────────────────────

export function withValidation<T>(schema: ZodSchema<T>, source: 'body' | 'query' = 'body') {
  return function (handler: (req: AuthenticatedRequest & { validated: T }, res: NextApiResponse) => Promise<void> | void) {
    return async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const data = source === 'body' ? req.body : req.query;
      const result = schema.safeParse(data);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.error.flatten().fieldErrors,
        });
      }

      (req as any).validated = result.data;
      return handler(req as any, res);
    };
  };
}

// ── Rate Limiting ────────────────────────────────────────
// Uses in-memory Map with optional Redis upgrade path.

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart > 120_000) {
        rateLimitStore.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export function withRateLimit(config: RateLimitConfig) {
  return function (handler: ApiHandler): ApiHandler {
    return async (req, res) => {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
      const address = req.session?.address || 'anon';
      const key = `${config.keyPrefix || 'rl'}:${address}:${ip}`;

      const now = Date.now();
      const entry = rateLimitStore.get(key);

      if (!entry || now - entry.windowStart > config.windowMs) {
        rateLimitStore.set(key, { count: 1, windowStart: now });
      } else if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((config.windowMs - (now - entry.windowStart)) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());
        return res.status(429).json({
          error: 'Rate limited. Please wait before making more requests.',
          retryAfterSeconds: retryAfter,
        });
      } else {
        entry.count++;
      }

      return handler(req, res);
    };
  };
}

// ── Compose Middlewares ──────────────────────────────────

type Middleware = (handler: ApiHandler) => ApiHandler;

export function compose(...middlewares: Middleware[]) {
  return function (handler: ApiHandler): ApiHandler {
    return middlewares.reduceRight((h, mw) => mw(h), handler);
  };
}

// ── Method Guard ─────────────────────────────────────────

export function withMethod(...methods: string[]) {
  return function (handler: ApiHandler): ApiHandler {
    return async (req, res) => {
      if (!methods.includes(req.method || '')) {
        res.setHeader('Allow', methods.join(', '));
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
      }
      return handler(req, res);
    };
  };
}
