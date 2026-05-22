/**
 * PumpX — AI Market Creator Component
 *
 * Natural language input → AI parses → auto-fills market creation form.
 * Users type something like "bet on PEPE reaching 1 trillion by June"
 * and the AI extracts all parameters to populate the form.
 */

import React, { useState, useCallback } from 'react';
import { LuBot, LuSparkles, LuArrowRight, LuLoader2, LuCheck, LuAlertTriangle, LuMic } from 'react-icons/lu';

interface ParsedMarket {
  question: string | null;
  tokenAddress: string | null;
  tokenSymbol: string | null;
  threshold: number | null;
  deadline: string | null;
  confidence: number;
  suggestedQuestion: string | null;
  reasoning: string | null;
}

interface AIMarketCreatorProps {
  onParsed: (data: ParsedMarket) => void;
  onStartVoice?: () => void;
  voiceSupported?: boolean;
}

const EXAMPLE_PROMPTS = [
  'Will PEPE reach 1 trillion total supply by June 2026?',
  'Bet on USDC supply hitting 50 billion in 30 days',
  'Create a market for DOGE token reaching 200B supply next month',
  'Will the new memecoin at 0x1234...abcd pass 10M supply by April?',
];

export function AIMarketCreator({ onParsed, onStartVoice, voiceSupported }: AIMarketCreatorProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedMarket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseInput = useCallback(async (text?: string) => {
    const value = text || input;
    if (!value.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/parse-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to parse');
      }

      const data = await res.json();
      if (data.success && data.parsed) {
        setResult(data.parsed);
        onParsed(data.parsed);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse market');
    } finally {
      setLoading(false);
    }
  }, [input, loading, onParsed]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      parseInput();
    }
  };

  return (
    <div className="space-y-4">
      {/* AI Input */}
      <div className="relative">
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <LuSparkles className="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your prediction market in plain English..."
          rows={3}
          className="w-full pl-10 pr-24 py-3 bg-[var(--bg-elevated)] border border-white/10 rounded-xl text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/40 resize-none"
          disabled={loading}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          {voiceSupported && (
            <button
              onClick={onStartVoice}
              className="p-2 rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
              title="Voice input"
            >
              <LuMic className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => parseInput()}
            disabled={!input.trim() || loading}
            className="px-3 py-1.5 bg-[var(--accent-primary)] text-black text-xs font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <LuLoader2 className="w-3.5 h-3.5 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <LuBot className="w-3.5 h-3.5" />
                Parse
              </>
            )}
          </button>
        </div>
      </div>

      {/* Example prompts */}
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] text-[var(--text-muted)] self-center">Try:</span>
          {EXAMPLE_PROMPTS.slice(0, 3).map((prompt, i) => (
            <button
              key={i}
              onClick={() => { setInput(prompt); parseInput(prompt); }}
              className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/30 hover:text-[var(--accent-primary)] transition-colors"
            >
              {prompt.length > 45 ? prompt.slice(0, 45) + '...' : prompt}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 border border-red-400/10 px-3 py-2 rounded-lg">
          <LuAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Parsed Result Preview */}
      {result && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--accent-primary)]/20 rounded-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LuCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">AI Parsed Successfully</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)]">Confidence:</span>
              <span className={`text-xs font-mono font-medium ${
                result.confidence >= 80 ? 'text-emerald-400' :
                result.confidence >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {result.confidence}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.question && (
              <div className="col-span-2">
                <span className="text-[var(--text-muted)]">Question</span>
                <p className="text-white font-medium mt-0.5">{result.question}</p>
              </div>
            )}
            {result.tokenSymbol && (
              <div>
                <span className="text-[var(--text-muted)]">Token</span>
                <p className="text-white font-mono mt-0.5">${result.tokenSymbol}</p>
              </div>
            )}
            {result.tokenAddress && (
              <div>
                <span className="text-[var(--text-muted)]">Address</span>
                <p className="text-white font-mono mt-0.5 truncate">{result.tokenAddress}</p>
              </div>
            )}
            {result.threshold && (
              <div>
                <span className="text-[var(--text-muted)]">Threshold</span>
                <p className="text-white font-mono mt-0.5">{result.threshold.toLocaleString()}</p>
              </div>
            )}
            {result.deadline && (
              <div>
                <span className="text-[var(--text-muted)]">Deadline</span>
                <p className="text-white font-mono mt-0.5">{new Date(result.deadline).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {result.reasoning && (
            <p className="text-[10px] text-[var(--text-muted)] italic border-t border-white/5 pt-2">
              {result.reasoning}
            </p>
          )}

          {result.suggestedQuestion && result.suggestedQuestion !== result.question && (
            <div className="bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/10 rounded-lg px-3 py-2">
              <span className="text-[10px] text-[var(--accent-primary)]">AI Suggestion:</span>
              <p className="text-xs text-white mt-0.5">{result.suggestedQuestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
