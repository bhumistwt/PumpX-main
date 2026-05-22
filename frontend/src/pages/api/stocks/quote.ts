/**
 * GET /api/stocks/quote?symbol=AAPL
 * Returns real-time stock quote with caching + fallback
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
      return res.status(503).json({ error: 'No stock data provider configured. Set ALPHA_VANTAGE_API_KEY or TWELVE_DATA_API_KEY.' });
    }

    const quote = await client.getQuote(symbol.toUpperCase());

    // Cache in browser for 30s
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
