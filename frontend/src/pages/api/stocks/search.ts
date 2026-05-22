/**
 * GET /api/stocks/search?q=apple
 * Returns matching stock symbols
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { getStockClient } from '../../../lib/stockData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.length < 1) {
    return res.status(400).json({ error: 'Missing search query (q)' });
  }

  try {
    const client = getStockClient();
    if (!client.hasProvider) {
      return res.status(503).json({ error: 'No stock data provider configured' });
    }

    const results = await client.search(q);

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({ query: q, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: message });
  }
}
