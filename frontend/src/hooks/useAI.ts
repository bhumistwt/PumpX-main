/**
 * PumpX AI Layer — React Hooks
 *
 * useAIChat      — Full chat state machine (messages, send, function dispatch, confirmations)
 * useReputation  — Single address reputation lookup
 * useAIReady     — Quick check if AI is available
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useTextToSpeech } from './useTextToSpeech';
import type { UseTextToSpeechReturn } from './useTextToSpeech';
import { useAccount, useBalance, usePublicClient, useWriteContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import type {
  ChatMessage,
  AIRequestMessage,
  AIResponse,
  ActionPayload,
  FunctionCallResult,
  FunctionExecutionContext,
  ReputationData,
} from '../lib/ai/types';
import {
  executeFunction,
  requiresOnChainExecution,
  onChainExecutors,
  FUNCTION_NAMES,
} from '../lib/ai/functions';
import {
  checkRateLimit,
  validateAIFunctionCall,
} from '../lib/ai/security';
// Gamification XP for AI usage is now handled via useGamification context at the component level

// ── Unique ID generator ────────────────────────────────

let _msgId = 0;
function uid(): string {
  return `msg_${Date.now()}_${++_msgId}`;
}

// ── useAIChat ──────────────────────────────────────────

export interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  isExecuting: boolean;
  pendingAction: ActionPayload | null;
  pendingTxHash: `0x${string}` | undefined;
  txConfirming: boolean;
  txConfirmed: boolean;
  sendMessage: (text: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  clearMessages: () => void;
  tts: UseTextToSpeechReturn;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionPayload | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  // Text-to-Speech for bot responses
  const tts = useTextToSpeech();

  const historyRef = useRef<AIRequestMessage[]>([]);

  // Wagmi hooks
  const { address: userAddress, isConnected, chain } = useAccount();
  const { data: balanceData } = useBalance({ address: userAddress });
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  // Tx confirmation watcher
  const { isLoading: txConfirming, isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  // Market context for system prompt
  const marketContext = useMemo(() => {
    if (typeof window === 'undefined') return { activeMarkets: 0, totalVolume: 0 };
    try {
      const markets = JSON.parse(localStorage.getItem('prediction-markets') || '[]');
      const active = markets.filter((m: any) => !m.resolved);
      const vol = markets.reduce((s: number, m: any) => s + (m.yesPool || 0) + (m.noPool || 0), 0);
      return { activeMarkets: active.length, totalVolume: parseFloat(vol.toFixed(4)) };
    } catch {
      return { activeMarkets: 0, totalVolume: 0 };
    }
  }, [messages.length]); // Recompute when messages change (potential market updates)

  // ── Add message helper ─────────────────────────────

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = { ...msg, id: uid(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full;
  }, []);

  // ── Handle function call result ────────────────────

  const handleFunctionResult = useCallback((result: FunctionCallResult) => {
    if (!result.success) {
      if (result.needsWallet) {
        addMessage({ type: 'error', content: '🔗 Please connect your wallet to execute this action.' });
      } else {
        addMessage({ type: 'error', content: `❌ ${result.error || 'Unknown error'}` });
      }
      return;
    }

    // Read-only results → display as bot message
    if (result.status === 'ready') {
      const data = result.data || {};
      let content = '';

      switch (result.type) {
        case 'check_market_status':
          if (data.found === false) {
            content = `Market not found at ${data.marketAddress}. It may exist on-chain but isn't tracked locally.`;
          } else {
            content = `📊 **${data.question}**\n\nStatus: ${data.status}\nYES Pool: ${data.yesPool} ETH (${data.yesOdds})\nNO Pool: ${data.noPool} ETH (${data.noOdds})\nTotal: ${data.totalPool} ETH\nDeadline: ${data.deadline}\nBets: ${data.betsCount}`;
            if (data.stockTicker) content += `\nLinked: $${data.stockTicker}`;
          }
          break;

        case 'check_user_portfolio':
          if ((data.positions as any[])?.length === 0) {
            content = `No positions found for ${(data.address as string)?.slice(0, 8)}...`;
          } else {
            content = `📁 **Portfolio** (${data.marketsCount} markets, ${data.totalInvested} ETH invested)\n\n`;
            (data.positions as any[])?.forEach((p: any) => {
              content += `• ${p.market}\n  YES: ${p.yesPosition} ETH | NO: ${p.noPosition} ETH | ${p.outcome}\n`;
            });
          }
          break;

        case 'show_trending_markets': {
          // __fetchFromApi signal: go get real data from Polymarket
          if (data.__fetchFromApi) {
            const params = new URLSearchParams({ limit: '20' });
            if (data.query) params.set('q', data.query as string);
            if (data.category) params.set('category', data.category as string);

            fetch(`/api/markets/trending?${params}`)
              .then(r => r.json())
              .then(json => {
                const markets = json.markets as any[];
                if (!markets?.length) {
                  addMessage({ type: 'bot', content: '📊 No active prediction markets found right now. Try again shortly.' });
                  return;
                }
                let msg = `🔥 **Trending Prediction Markets** (live from Polymarket)\n\n`;
                markets.slice(0, 12).forEach((m, i) => {
                  // outcomePrices may be a JSON string or array
                  let prices: any[] = [];
                  try {
                    prices = typeof m.outcomePrices === 'string'
                      ? JSON.parse(m.outcomePrices)
                      : Array.isArray(m.outcomePrices) ? m.outcomePrices : [];
                  } catch { prices = []; }
                  const yesProb = prices.length >= 1 ? Number(prices[0]) : NaN;
                  const yesPct = !isNaN(yesProb) ? (yesProb * 100).toFixed(0) : 'N/A';
                  const vol = m.volume24hr > 1000
                    ? `$${(m.volume24hr / 1000).toFixed(0)}K`
                    : `$${Math.round(m.volume24hr || 0)}`;
                  msg += `**${i + 1}. ${m.question}**\n`;
                  msg += `   ✅ YES ${yesPct}% · 💰 ${vol} 24h vol · 🏷 ${m.category}\n\n`;
                });
                msg += `_Want to bet on any of these? Just ask!_`;
                addMessage({ type: 'bot', content: msg });
                tts.speak(msg);
              })
              .catch(() => {
                addMessage({ type: 'bot', content: '❌ Could not fetch live markets right now. Try again in a moment.' });
              });
            // Show "fetching..." message immediately
            addMessage({ type: 'system', content: '🌐 Fetching live markets from Polymarket...' });
            setMessages(prev => prev.filter(m => m.content !== '🌐 Fetching live markets from Polymarket...'));
            return;
          }

          // Fallback: if data included markets array already
          if (!(data.markets as any[])?.length) {
            content = 'No active markets found. Create the first one!';
          } else {
            content = `🔥 **Trending Markets**\n\n`;
            (data.markets as any[])?.forEach((m: any, i: number) => {
              content += `${i + 1}. ${m.question} — YES ${m.yesOdds} | Pool: ${m.totalPool} ETH\n`;
            });
          }
          break;
        }

        case 'show_sentiment_index':
          content = `📈 **Sentiment Index** ${data.ticker !== 'ALL' ? `($${data.ticker})` : ''}\n\n🟢 Bullish: ${data.bullish}\n🔴 Bearish: ${data.bearish}\nVolume: ${data.totalVolume} ETH across ${data.activeMarkets} markets`;
          break;

        default:
          content = JSON.stringify(data, null, 2);
      }

      addMessage({ type: 'bot', content });
      tts.speak(content);
      return;
    }

    // Action requiring confirmation → set pending
    if (result.status === 'pending_confirmation') {
      const action: ActionPayload = {
        functionName: result.type,
        displayName: result.displayName || result.type,
        params: result.data || {},
        summary: result.summary || [],
        estimatedGas: result.estimatedGas,
        status: 'pending_confirmation',
      };

      setPendingAction(action);
      addMessage({
        type: 'action',
        content: `⚡ ${action.displayName}`,
        action,
      });
    }
  }, [addMessage]);

  // ── Send message ───────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Rate limit check
    const rl = checkRateLimit(userAddress || 'anon', 'chat');
    if (!rl.allowed) {
      addMessage({ type: 'error', content: `⏳ Rate limited. Try again in ${Math.ceil((rl.retryAfterMs || 0) / 1000)}s.` });
      return;
    }

    // Add user message
    addMessage({ type: 'user', content: text });

    // Track in conversation history
    historyRef.current.push({ role: 'user', content: text });

    setIsLoading(true);
    addMessage({ type: 'system', content: 'Thinking...' });

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyRef.current,
          context: {
            isConnected,
            address: userAddress,
            chainId: chain?.id,
            chainName: chain?.name,
            ethBalance: balanceData?.formatted,
            ...marketContext,
          },
        }),
      });

      // Remove "Thinking..." message
      setMessages(prev => prev.filter(m => m.content !== 'Thinking...'));

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'AI service unavailable' }));
        const detail = err.details ? ` (${err.details})` : '';
        addMessage({ type: 'error', content: `❌ ${err.error || 'Request failed'}${detail}` });
        return;
      }

      const data: AIResponse = await response.json();

      if (data.type === 'function_call' && data.function_call) {
        // Validate the AI's function call
        const validation = validateAIFunctionCall(
          data.function_call.name,
          data.function_call.arguments,
          FUNCTION_NAMES
        );

        if (!validation.valid) {
          addMessage({ type: 'error', content: `⚠️ AI suggested an invalid action: ${validation.error}` });
          return;
        }

        // Execute the function (prepare phase)
        const result = executeFunction(
          data.function_call.name,
          validation.args!,
          userAddress
        );

        // Track in history
        historyRef.current.push({
          role: 'assistant',
          content: '',
          function_call: {
            name: data.function_call.name,
            arguments: data.function_call.arguments,
          },
        });

        handleFunctionResult(result);
      } else if (data.message) {
        addMessage({ type: 'bot', content: data.message });
        tts.speak(data.message);
        historyRef.current.push({ role: 'assistant', content: data.message });

        // AI usage XP is triggered via GamificationProvider.onAIUsed() at the component level
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.content !== 'Thinking...'));
      addMessage({ type: 'error', content: `❌ ${err.message || 'Failed to reach AI'}` });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, userAddress, isConnected, chain, balanceData, marketContext, addMessage, handleFunctionResult, tts]);

  // ── Confirm action (execute on-chain) ──────────────

  const confirmAction = useCallback(async () => {
    if (!pendingAction || isExecuting) return;

    const functionName = pendingAction.functionName;
    if (!requiresOnChainExecution(functionName)) return;

    setIsExecuting(true);
    setPendingAction(prev => prev ? { ...prev, status: 'executing' } : null);

    try {
      const ctx: FunctionExecutionContext = {
        userAddress,
        chainId: chain?.id,
        writeContract: writeContractAsync as any,
        sendTransaction: sendTransactionAsync as any,
        publicClient,
      };

      const executor = onChainExecutors[functionName];
      const result = await executor(pendingAction.params, ctx);

      if (result.success && result.hash) {
        setPendingTxHash(result.hash as `0x${string}`);

        addMessage({
          type: 'attestation',
          content: `✅ Transaction submitted!`,
          attestation: {
            txHash: result.hash,
            explorerUrl: `https://sepolia.basescan.org/tx/${result.hash}`,
            summary: [
              ...pendingAction.summary,
              { label: 'Tx Hash', value: `${result.hash.slice(0, 10)}...${result.hash.slice(-8)}` },
            ],
          },
        });

        // Track in history
        historyRef.current.push({
          role: 'assistant',
          content: `Transaction confirmed: ${result.hash}`,
        });
      } else {
        addMessage({ type: 'error', content: `❌ Transaction failed: ${result.error}` });
      }
    } catch (err: any) {
      addMessage({ type: 'error', content: `❌ ${err?.shortMessage || err?.message || 'Transaction rejected'}` });
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  }, [pendingAction, isExecuting, userAddress, chain, writeContractAsync, sendTransactionAsync, publicClient, addMessage]);

  // ── Cancel action ──────────────────────────────────

  const cancelAction = useCallback(() => {
    setPendingAction(null);
    addMessage({ type: 'system', content: 'Action cancelled.' });
  }, [addMessage]);

  // ── Clear all messages ─────────────────────────────

  const clearMessages = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
    setPendingAction(null);
    setPendingTxHash(undefined);
  }, []);

  return {
    messages,
    isLoading,
    isExecuting,
    pendingAction,
    pendingTxHash,
    txConfirming,
    txConfirmed,
    sendMessage,
    confirmAction,
    cancelAction,
    clearMessages,
    tts,
  };
}

// ── useReputation ──────────────────────────────────────

export function useReputation(address: string | undefined): {
  data: ReputationData | null;
  loading: boolean;
  refetch: () => void;
} {
  const [data, setData] = useState<ReputationData | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/reputation?address=${address}`);
      const json = await res.json();
      setData(json.reputation || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  // Auto-fetch on mount
  useState(() => { if (address) refetch(); });

  return { data, loading, refetch };
}

// ── useAIReady ─────────────────────────────────────────

export function useAIReady(): boolean {
  // AI is always available as long as the API route exists
  // The actual API key check happens server-side
  return true;
}
