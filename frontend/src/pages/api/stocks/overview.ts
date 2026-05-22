/**
 * GET /api/stocks/overview?symbol=AAPL
 * Returns company fundamentals (sector, PE, EPS, market cap, etc.)
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStockClient } from '../../../lib/stockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol } = req.query;
  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    const client = getStockClient();
    if (!client.hasProvider) {
      return res.status(503).json({ error: 'No stock data provider configured' });
    }

    const overview = await client.getOverview(symbol.toUpperCase());

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
    return res.status(200).json(overview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
