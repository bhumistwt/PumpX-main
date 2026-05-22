/**
 * PumpX — Live Worldwide Markets API
 *
 * Returns a snapshot of global markets:
 *   - Top 50 cryptocurrencies (CoinGecko)
 *   - Forex pairs (Frankfurter / ECB)
 *   - Global crypto stats
 *   - Trending coins
 *   - World indices & commodities (enriched when API keys present)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchLiveMarketsSnapshot, type LiveMarketsSnapshot } from '../../lib/liveMarkets';

let lastSnapshot: LiveMarketsSnapshot | null = null;
let lastFetchTime = 0;
const MIN_INTERVAL = 30_000; // 30s between full refreshes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Serve stale data while revalidating if within interval
    const now = Date.now();
    if (lastSnapshot && now - lastFetchTime < MIN_INTERVAL) {
      return res.status(200).json(lastSnapshot);
    }

    const snapshot = await fetchLiveMarketsSnapshot();
    lastSnapshot = snapshot;
    lastFetchTime = now;

    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error('[LiveMarkets API]', error);

    // Return stale data on error
    if (lastSnapshot) {
      return res.status(200).json(lastSnapshot);
    }

    return res.status(500).json({ error: 'Failed to fetch market data' });
  }
}
