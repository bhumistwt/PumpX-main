/**
 * PumpX — Telegram Bot Webhook API
 *
 * POST /api/telegram/webhook
 *
 * Receives Telegram bot updates and handles commands:
 *   /start     — Welcome message
 *   /markets   — List active markets
 *   /market <address> — Get market details
 *   /create <description> — AI-parse a market creation request
 *   /sentiment — Overall market sentiment
 *   /risk <tokenAddress> — AI risk analysis
 *   /help      — Command list
 *
 * Setup:
 * 1. Create bot via @BotFather
 * 2. Set TELEGRAM_BOT_TOKEN env var
 * 3. Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/telegram/webhook
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../server/db';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

async function sendMessage(chatId: number, text: string, parseMode = 'HTML') {
  if (!BOT_TOKEN) return;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
}

function formatEthFromWei(weiStr: string): string {
  try {
    return (Number(BigInt(weiStr)) / 1e18).toFixed(4);
  } catch {
    return '0';
  }
}

async function handleCommand(chatId: number, text: string) {
  const [command, ...args] = text.split(' ');
  const cmd = command.toLowerCase().replace('@pumpxbot', ''); // Remove bot mention

  switch (cmd) {
    case '/start': {
      await sendMessage(chatId, `
🚀 <b>Welcome to PumpX Bot!</b>

I'm your prediction market assistant on Base chain.

<b>Commands:</b>
/markets — Browse active markets
/market &lt;address&gt; — Market details
/create &lt;description&gt; — AI-parse a market idea
/sentiment — Overall market sentiment
/risk &lt;token_address&gt; — AI token risk analysis
/help — Show all commands

📊 Create and bet on token supply prediction markets!
      `.trim());
      break;
    }

    case '/help': {
      await sendMessage(chatId, `
📖 <b>PumpX Bot Commands</b>

/markets — List active prediction markets
/market &lt;0x...&gt; — Details for a specific market
/create &lt;text&gt; — Describe a market in plain English and AI will parse it
/sentiment — Overall market sentiment index
/risk &lt;0x...&gt; — AI risk score for a token contract
/stats — Platform statistics

💡 <i>Example: /create Will PEPE reach 1 trillion supply by June 2026?</i>
      `.trim());
      break;
    }

    case '/markets': {
      try {
        const markets = await prisma.market.findMany({
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            contractAddress: true,
            question: true,
            yesPool: true,
            noPool: true,
            deadline: true,
            stockTicker: true,
            _count: { select: { bets: true } },
          },
        });

        if (markets.length === 0) {
          await sendMessage(chatId, '📭 No active markets. Visit PumpX to create the first one!');
          break;
        }

        let response = '📊 <b>Active Markets</b>\n\n';
        markets.forEach((m, i) => {
          const yesWei = BigInt(m.yesPool);
          const noWei = BigInt(m.noPool);
          const totalWei = yesWei + noWei;
          const yesRatio = totalWei > 0n ? Number((yesWei * 10000n) / totalWei) / 100 : 50;
          const totalEth = formatEthFromWei(m.yesPool) + formatEthFromWei(m.noPool);

          response += `<b>${i + 1}.</b> ${m.question}\n`;
          response += `   📈 YES: ${yesRatio.toFixed(0)}% | 💰 Pool: ${totalEth} ETH | 🎯 ${m._count.bets} bets\n`;
          if (m.stockTicker) response += `   🏷 $${m.stockTicker}\n`;
          response += `   📅 Deadline: ${new Date(m.deadline).toLocaleDateString()}\n\n`;
        });

        await sendMessage(chatId, response.trim());
      } catch (err) {
        await sendMessage(chatId, '❌ Failed to fetch markets. Please try again.');
      }
      break;
    }

    case '/market': {
      const address = args[0];
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        await sendMessage(chatId, '⚠️ Usage: /market &lt;0x...address&gt;');
        break;
      }

      try {
        const market = await prisma.market.findUnique({
          where: { contractAddress: address.toLowerCase() },
          include: { _count: { select: { bets: true } } },
        });

        if (!market) {
          await sendMessage(chatId, '❌ Market not found.');
          break;
        }

        const yesWei = BigInt(market.yesPool);
        const noWei = BigInt(market.noPool);
        const totalWei = yesWei + noWei;
        const yesRatio = totalWei > 0n ? Number((yesWei * 10000n) / totalWei) / 100 : 50;
        const isActive = !market.resolved && new Date(market.deadline).getTime() > Date.now();

        await sendMessage(chatId, `
📊 <b>${market.question}</b>

Status: ${market.resolved ? (market.reached ? '✅ REACHED' : '❌ FAILED') : isActive ? '🟢 ACTIVE' : '🔴 EXPIRED'}
${market.stockTicker ? `Ticker: $${market.stockTicker}\n` : ''}
📈 YES: ${yesRatio.toFixed(1)}% (${formatEthFromWei(market.yesPool)} ETH)
📉 NO: ${(100 - yesRatio).toFixed(1)}% (${formatEthFromWei(market.noPool)} ETH)
💰 Total Pool: ${(Number(totalWei) / 1e18).toFixed(4)} ETH
🎯 Bets: ${market._count.bets}
📅 Deadline: ${new Date(market.deadline).toLocaleDateString()}

🔗 <code>${market.contractAddress}</code>
        `.trim());
      } catch {
        await sendMessage(chatId, '❌ Failed to fetch market details.');
      }
      break;
    }

    case '/create': {
      const description = args.join(' ');
      if (!description || description.length < 10) {
        await sendMessage(chatId, '⚠️ Usage: /create &lt;description&gt;\n\n💡 Example: /create Will PEPE reach 1 trillion supply by June 2026?');
        break;
      }

      // Use the AI parse-market endpoint
      const apiKey = process.env.REDPILL_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        await sendMessage(chatId, '❌ AI not configured on this instance.');
        break;
      }

      const apiUrl = process.env.AI_API_URL || 'https://api.red-pill.ai/v1/chat/completions';
      const model = process.env.AI_MODEL || 'gpt-4o';

      try {
        await sendMessage(chatId, '🤖 Analyzing your market idea...');

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'Extract prediction market parameters from text. Return JSON: { "question": string, "tokenSymbol": string, "threshold": number, "deadline": "YYYY-MM-DD", "confidence": 0-100 }',
              },
              { role: 'user', content: description },
            ],
            temperature: 0.3,
            max_tokens: 300,
          }),
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          await sendMessage(chatId, `
🤖 <b>AI Market Parser</b>

📋 <b>Question:</b> ${parsed.question || 'N/A'}
🪙 <b>Token:</b> ${parsed.tokenSymbol || 'Unknown'}
📊 <b>Threshold:</b> ${parsed.threshold?.toLocaleString() || 'N/A'}
📅 <b>Deadline:</b> ${parsed.deadline || 'N/A'}
🎯 <b>Confidence:</b> ${parsed.confidence || 0}%

💡 Visit PumpX web app to deploy this market on-chain!
          `.trim());
        } else {
          await sendMessage(chatId, '❌ Could not parse market parameters. Try being more specific.');
        }
      } catch {
        await sendMessage(chatId, '❌ AI analysis failed. Please try again.');
      }
      break;
    }

    case '/sentiment': {
      try {
        const markets = await prisma.market.findMany({
          where: { resolved: false },
          select: { yesPool: true, noPool: true },
        });

        let totalYes = 0n;
        let totalNo = 0n;
        for (const m of markets) {
          totalYes += BigInt(m.yesPool);
          totalNo += BigInt(m.noPool);
        }

        const total = totalYes + totalNo;
        const yesRatio = total > 0n ? Number((totalYes * 10000n) / total) / 100 : 50;

        const emoji = yesRatio >= 60 ? '🟢' : yesRatio >= 40 ? '🟡' : '🔴';
        const label = yesRatio >= 60 ? 'Bullish' : yesRatio >= 40 ? 'Neutral' : 'Bearish';

        await sendMessage(chatId, `
${emoji} <b>Market Sentiment: ${label}</b>

📈 YES (Bullish): ${yesRatio.toFixed(1)}%
📉 NO (Bearish): ${(100 - yesRatio).toFixed(1)}%
📊 Active Markets: ${markets.length}
💰 Total Volume: ${(Number(total) / 1e18).toFixed(4)} ETH
        `.trim());
      } catch {
        await sendMessage(chatId, '❌ Failed to calculate sentiment.');
      }
      break;
    }

    case '/stats': {
      try {
        const [totalMarkets, totalBets, totalUsers] = await Promise.all([
          prisma.market.count(),
          prisma.bet.count(),
          prisma.user.count(),
        ]);

        await sendMessage(chatId, `
📊 <b>PumpX Stats</b>

🏪 Total Markets: ${totalMarkets}
🎯 Total Bets: ${totalBets}
👥 Total Users: ${totalUsers}

🔗 Powered by Base Chain
        `.trim());
      } catch {
        await sendMessage(chatId, '❌ Failed to fetch stats.');
      }
      break;
    }

    default: {
      if (command.startsWith('/')) {
        await sendMessage(chatId, `❓ Unknown command: ${command}\n\nType /help for available commands.`);
      }
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!BOT_TOKEN) {
    return res.status(200).json({ ok: true }); // Silently ignore if not configured
  }

  try {
    const update: TelegramUpdate = req.body;

    if (update.message?.text) {
      await handleCommand(update.message.chat.id, update.message.text);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
}
