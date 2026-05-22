/**
 * POST /api/auth/logout
 * Destroy the current session.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '../../../server/session';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';
import { createLogger } from '../../../server/logger';

const log = createLogger('auth:logout');

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  const address = session.address;

  session.destroy();

  log.info({ address }, 'User logged out');

  res.status(200).json({ ok: true });
}

export default compose(withErrorHandler, withMethod('POST'))(handler);
