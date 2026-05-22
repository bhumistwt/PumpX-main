/**
 * PumpX — AI Market Parser
 *
 * POST /api/ai/parse-market
 *
 * Takes natural language input and uses AI to extract structured market creation parameters.
 * e.g. "Create a market predicting PEPE will reach 1 trillion supply by June 2026"
 * → { question, tokenAddress, threshold, deadline, confidence }
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const PARSE_SYSTEM_PROMPT = `You are a prediction market parameter extractor. Given a natural language description, extract structured parameters for creating a token supply prediction market on PumpX (Base chain).

EXTRACT these fields:
1. question: A clear prediction question (e.g. "Will PEPE reach 1T supply by June 2026?")
2. tokenAddress: ERC-20 token contract address if mentioned (or null)
3. tokenSymbol: Token symbol if mentioned (e.g. "PEPE", "DOGE")
4. threshold: The supply threshold number (as a raw number, e.g. 1000000000000 for 1 trillion)
5. deadline: ISO date string for when the prediction expires (e.g. "2026-06-30T00:00:00Z")
6. confidence: Your confidence in the extraction (0-100)
7. suggestedQuestion: If the user's input is vague, suggest a better-worded question

RULES:
- If the user says "1 trillion" → threshold = 1000000000000
- If the user says "1 billion" → threshold = 1000000000
- If the user says "1 million" → threshold = 1000000
- Parse relative dates: "next month" → first of next month, "30 days" → 30 days from now
- If no token address provided but symbol given, set tokenAddress to null
- Always respond with valid JSON only, no markdown

RESPOND with ONLY a JSON object like:
{
  "question": "Will PEPE reach 1T total supply by June 30, 2026?",
  "tokenAddress": null,
  "tokenSymbol": "PEPE",
  "threshold": 1000000000000,
  "deadline": "2026-06-30T00:00:00Z",
  "confidence": 85,
  "suggestedQuestion": null,
  "reasoning": "User wants to bet on PEPE token supply reaching 1 trillion"
}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.REDPILL_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI API key not configured' });
  }

  const apiUrl = process.env.AI_API_URL || 'https://api.red-pill.ai/v1/chat/completions';
  const model = process.env.AI_MODEL || 'gpt-4o';

  try {
    const { input } = req.body as { input: string };

    if (!input || typeof input !== 'string' || input.trim().length < 5) {
      return res.status(400).json({ error: 'Input must be at least 5 characters' });
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PARSE_SYSTEM_PROMPT },
          { role: 'user', content: input.trim() },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      return res.status(502).json({ error: 'Invalid AI response' });
    }

    const text = data.choices[0].message.content;

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'AI did not return valid JSON' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      success: true,
      parsed: {
        question: parsed.question || null,
        tokenAddress: parsed.tokenAddress || null,
        tokenSymbol: parsed.tokenSymbol || null,
        threshold: parsed.threshold || null,
        deadline: parsed.deadline || null,
        confidence: parsed.confidence || 0,
        suggestedQuestion: parsed.suggestedQuestion || null,
        reasoning: parsed.reasoning || null,
      },
    });
  } catch (error: any) {
    console.error('AI parse-market error:', error);
    return res.status(500).json({ error: 'Failed to parse market parameters' });
  }
}
