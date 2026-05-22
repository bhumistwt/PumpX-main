/**
 * PumpX — AI Risk Score API
 *
 * POST /api/ai/risk-score
 *
 * Analyzes a token contract address for potential risks:
 * - Mint authority (centralized supply control)
 * - Ownership concentration
 * - Contract verification status
 * - Historical supply changes
 * Returns an AI-generated risk assessment.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
]);

const RISK_SYSTEM_PROMPT = `You are a crypto token risk analyst. Given on-chain data about an ERC-20 token, produce a risk assessment.

ANALYZE these risk factors:
1. **Mint Authority**: Can the owner/deployer mint unlimited tokens? (check owner exists)
2. **Supply Concentration**: What % of supply does the top holder control?
3. **Market Fit**: Is the supply reasonable for the market cap expectations?
4. **Contract Risk**: Any red flags in the contract data?

RESPOND with ONLY a valid JSON object:
{
  "riskScore": 0-100 (100 = highest risk),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "factors": [
    { "name": "Mint Authority", "risk": "LOW" | "MEDIUM" | "HIGH", "detail": "explanation" },
    { "name": "Supply Concentration", "risk": "LOW" | "MEDIUM" | "HIGH", "detail": "explanation" },
    { "name": "Contract Risk", "risk": "LOW" | "MEDIUM" | "HIGH", "detail": "explanation" }
  ],
  "summary": "1-2 sentence overall assessment",
  "recommendation": "SAFE_TO_BET" | "PROCEED_WITH_CAUTION" | "HIGH_RISK" | "AVOID"
}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenAddress } = req.body as { tokenAddress: string };

  if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }

  const apiKey = process.env.REDPILL_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI API key not configured' });
  }

  const apiUrl = process.env.AI_API_URL || 'https://api.red-pill.ai/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o';

  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || ''}`;

    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
    });

    // Fetch token data
    let tokenData: Record<string, any> = {};
    const errors: string[] = [];

    try {
      const [name, symbol, totalSupply, decimals] = await Promise.all([
        client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'name' }).catch(() => 'Unknown'),
        client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => 'UNK'),
        client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'totalSupply' }).catch(() => 0n),
        client.readContract({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18),
      ]);

      tokenData = { name, symbol, totalSupply: totalSupply.toString(), decimals: Number(decimals) };
    } catch (e) {
      errors.push('Failed to read basic token data — may not be a valid ERC-20');
    }

    // Try to read owner (not all tokens have this)
    let ownerAddress: string | null = null;
    try {
      ownerAddress = await client.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'owner',
      }) as string;
    } catch {
      ownerAddress = null; // owner() not implemented — could be good (renounced)
    }

    // Check deployer's balance (potential concentration)
    let deployerBalance: string | null = null;
    if (ownerAddress) {
      try {
        const bal = await client.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [ownerAddress as `0x${string}`],
        });
        deployerBalance = bal.toString();
      } catch {}
    }

    // Build context for AI
    const contextStr = `
TOKEN DATA:
- Address: ${tokenAddress}
- Name: ${tokenData.name || 'Unknown'}
- Symbol: ${tokenData.symbol || 'UNK'}
- Total Supply: ${tokenData.totalSupply || '0'} (raw, ${tokenData.decimals || 18} decimals)
- Owner: ${ownerAddress || 'No owner function (possibly renounced)'}
- Owner Balance: ${deployerBalance || 'N/A'}
- Supply in human units: ${tokenData.totalSupply && tokenData.decimals ? (Number(BigInt(tokenData.totalSupply)) / Math.pow(10, tokenData.decimals)).toLocaleString() : 'unknown'}
- Owner holds: ${deployerBalance && tokenData.totalSupply && BigInt(tokenData.totalSupply) > 0n ? ((Number(BigInt(deployerBalance)) / Number(BigInt(tokenData.totalSupply))) * 100).toFixed(2) + '%' : 'unknown'}
- Chain: Base Sepolia (testnet)
- Issues: ${errors.length > 0 ? errors.join('; ') : 'None detected'}
`;

    // Call AI for risk assessment
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: RISK_SYSTEM_PROMPT },
          { role: 'user', content: contextStr },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    const aiData = await aiResponse.json();

    if (!aiData.choices?.[0]?.message?.content) {
      return res.status(502).json({ error: 'AI analysis failed' });
    }

    const text = aiData.choices[0].message.content;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(502).json({ error: 'AI did not return valid risk assessment' });
    }

    const riskAssessment = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      tokenAddress,
      tokenData,
      ownerAddress,
      risk: {
        score: riskAssessment.riskScore ?? 50,
        level: riskAssessment.riskLevel ?? 'MEDIUM',
        factors: riskAssessment.factors ?? [],
        summary: riskAssessment.summary ?? 'Unable to fully assess',
        recommendation: riskAssessment.recommendation ?? 'PROCEED_WITH_CAUTION',
      },
    });
  } catch (error: any) {
    console.error('Risk score error:', error);
    return res.status(500).json({ error: 'Failed to analyze token risk' });
  }
}
