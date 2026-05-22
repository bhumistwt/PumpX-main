/**
 * GET /api/stocks/history?symbol=AAPL&days=30
 * Returns daily OHLCV history
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStockClient } from '../../../lib/stockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol, days } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  const numDays = Math.min(Math.max(parseInt(String(days || '30'), 10) || 30, 5), 365);

  try {
    const client = getStockClient();
    if (!client.hasProvider) {
      return res.status(503).json({ error: 'No stock data provider configured' });
    }

    const history = await client.getHistory(symbol.toUpperCase(), numDays);

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ symbol: symbol.toUpperCase(), days: numDays, data: history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
