import type { NextApiRequest, NextApiResponse } from 'next';
import { getRecentWhaleAlerts } from '../../../server/whaleAlerts';
import { withErrorHandler, withMethod, compose } from '../../../server/middleware';

async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const rows = await getRecentWhaleAlerts(20);

  return res.status(200).json({
    alerts: rows.map((w) => ({
      id: w.id,
      walletAddress: w.walletAddress,
      action: w.action,
      tokenAddress: w.tokenAddress,
      amount: w.amount,
      amountEth: (Number(BigInt(w.amount)) / 1e18).toFixed(4),
      txHash: w.txHash,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

export default compose(withErrorHandler, withMethod('GET'))(handler);
