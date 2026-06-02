import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase configuration' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // total markets (fast count using head)
    const marketsCountResp = await sb.from('Market').select('id', { head: true, count: 'exact' });
    const totalMarkets = marketsCountResp.count ?? 0;

    // total distinct creators (predictors)
    let totalPredictors = 0;
    try {
      const preds = await sb.from('Market').select('creatorAddress').distinct('creatorAddress');
      totalPredictors = Array.isArray(preds.data) ? preds.data.length : 0;
    } catch (e) {
      const list = await sb.from('Market').select('creatorAddress');
      const unique = new Set((list.data || []).map((r: any) => r.creatorAddress));
      totalPredictors = unique.size;
    }

    // total volume: sum yesPool + noPool (strings of wei). We'll fetch pools and aggregate in JS to avoid SQL type issues.
    const volResp = await sb.from('Market').select('yesPool,noPool');
    let totalWei = BigInt(0);
    if (Array.isArray(volResp.data)) {
      for (const row of volResp.data) {
        try {
          const y = BigInt(row.yesPool || '0');
          const n = BigInt(row.noPool || '0');
          totalWei += y + n;
        } catch (err) {
          // ignore malformed values
        }
      }
    }

    const totalEthVolume = Number(totalWei) / 1e18;

    const out = {
      // legacy keys (homepage compatibility)
      activeMarkets: Number(totalMarkets),
      totalEthVolume: Number((Math.round(totalEthVolume * 10000) / 10000).toFixed(4)),
      totalUsers: Number(totalPredictors),

      // new keys requested in Change #2
      totalMarkets: Number(totalMarkets),
      totalPredictors: Number(totalPredictors),
      totalVolume: Number((Math.round(totalEthVolume * 10000) / 10000).toFixed(4)),
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(out);
  } catch (err) {
    console.error('stats api error', err);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}
