/**
 * PumpX AI Reputation API Route
 *
 * GET /api/ai/reputation?address=0x...     → single reputation
 * GET /api/ai/reputation?all=true          → leaderboard
 * POST /api/ai/reputation                  → actions (flag, upvote, record)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getReputation,
  getLeaderboard,
  getFlags,
  flagAddress,
  upvoteAddress,
  recordMarketCreated,
  recordMarketResolved,
  recordBet,
  recordWin,
} from '../../../lib/ai/reputation';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { address, all } = req.query;

    if (all === 'true') {
      return res.status(200).json({ leaderboard: getLeaderboard(50) });
    }

    if (typeof address === 'string') {
      const rep = getReputation(address);
      const flags = getFlags(address);
      return res.status(200).json({ reputation: rep, flags });
    }

    return res.status(400).json({ error: 'Provide address or all=true' });
  }

  if (req.method === 'POST') {
    const { action, targetAddress, fromAddress, reason, amount } = req.body;

    if (!action || !targetAddress) {
      return res.status(400).json({ error: 'action and targetAddress are required' });
    }

    switch (action) {
      case 'flag':
        if (!fromAddress || !reason) {
          return res.status(400).json({ error: 'fromAddress and reason required for flagging' });
        }
        return res.status(200).json(flagAddress(targetAddress, fromAddress, reason));

      case 'upvote':
        if (!fromAddress) {
          return res.status(400).json({ error: 'fromAddress required for upvoting' });
        }
        return res.status(200).json(upvoteAddress(targetAddress, fromAddress));

      case 'record_market_created':
        return res.status(200).json({ data: recordMarketCreated(targetAddress) });

      case 'record_market_resolved':
        return res.status(200).json({ data: recordMarketResolved(targetAddress) });

      case 'record_bet':
        return res.status(200).json({ data: recordBet(targetAddress, amount || 0) });

      case 'record_win':
        return res.status(200).json({ data: recordWin(targetAddress) });

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
