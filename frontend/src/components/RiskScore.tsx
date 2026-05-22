/**
 * PumpX — AI Risk Score Component
 *
 * Displays the AI-generated risk assessment for a token.
 * Shows risk score gauge, factors, and recommendation.
 */

import React, { useState, useCallback } from 'react';
import { LuShieldCheck, LuShieldAlert, LuShield, LuLoader2, LuAlertTriangle, LuCheckCircle, LuInfo } from 'react-icons/lu';

interface RiskFactor {
  name: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  detail: string;
}

interface RiskData {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  summary: string;
  recommendation: string;
}

interface TokenData {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
}

interface RiskScoreProps {
  tokenAddress?: string;
  compact?: boolean;
}

const LEVEL_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  LOW: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
  MEDIUM: { text: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  HIGH: { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  CRITICAL: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
};

const REC_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  SAFE_TO_BET: { label: 'Safe to Bet', icon: LuCheckCircle, color: 'text-emerald-400' },
  PROCEED_WITH_CAUTION: { label: 'Proceed with Caution', icon: LuInfo, color: 'text-yellow-400' },
  HIGH_RISK: { label: 'High Risk', icon: LuAlertTriangle, color: 'text-orange-400' },
  AVOID: { label: 'Avoid', icon: LuShield, color: 'text-red-400' },
};

function RiskGauge({ score }: { score: number }) {
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees
  const color = score < 30 ? '#34d399' : score < 60 ? '#fbbf24' : score < 80 ? '#fb923c' : '#f87171';

  return (
    <div className="relative w-24 h-12 overflow-hidden">
      {/* Background arc */}
      <div className="absolute inset-0">
        <div className="w-24 h-24 rounded-full border-4 border-white/5" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
      </div>
      {/* Score arc */}
      <div className="absolute inset-0">
        <div
          className="w-24 h-24 rounded-full border-4 transition-all duration-1000"
          style={{
            borderColor: color,
            clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((rotation - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((rotation - 90) * Math.PI / 180)}%, 0 0, 100% 0)`,
          }}
        />
      </div>
      {/* Score text */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className="text-lg font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-[8px] text-[var(--text-muted)] block">/100</span>
      </div>
    </div>
  );
}

export function RiskScore({ tokenAddress, compact = false }: RiskScoreProps) {
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputAddress, setInputAddress] = useState(tokenAddress || '');

  const analyze = useCallback(async (address?: string) => {
    const addr = address || inputAddress;
    if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      setError('Enter a valid token address');
      return;
    }

    setLoading(true);
    setError(null);
    setRisk(null);

    try {
      const res = await fetch('/api/ai/risk-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: addr }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Analysis failed');
      }

      const data = await res.json();
      setRisk(data.risk);
      setTokenData(data.tokenData);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze token');
    } finally {
      setLoading(false);
    }
  }, [inputAddress]);

  // Auto-analyze if tokenAddress prop provided
  React.useEffect(() => {
    if (tokenAddress && !risk && !loading) {
      analyze(tokenAddress);
    }
  }, [tokenAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const levelColors = risk ? LEVEL_COLORS[risk.level] || LEVEL_COLORS.MEDIUM : null;
  const recConfig = risk ? REC_CONFIG[risk.recommendation] || REC_CONFIG.PROCEED_WITH_CAUTION : null;

  if (compact && risk) {
    const Icon = risk.score < 40 ? LuShieldCheck : risk.score < 70 ? LuShieldAlert : LuShield;
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg ${levelColors?.bg} ${levelColors?.border} border`}>
        <Icon className={`w-3 h-3 ${levelColors?.text}`} />
        <span className={`text-[10px] font-medium ${levelColors?.text}`}>
          Risk: {risk.score}/100
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input */}
      {!tokenAddress && (
        <div className="flex gap-2">
          <input
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            placeholder="0x... token address"
            className="flex-1 px-3 py-2 bg-[var(--bg-elevated)] border border-white/10 rounded-lg text-sm text-white font-mono placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]/40"
          />
          <button
            onClick={() => analyze()}
            disabled={loading}
            className="px-4 py-2 bg-[var(--accent-primary)] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <LuLoader2 className="w-4 h-4 animate-spin" /> : <LuShieldCheck className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card p-6 text-center">
          <LuLoader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-muted)]">AI is analyzing the token contract...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 border border-red-400/10 px-3 py-2 rounded-lg">
          <LuAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Risk Result */}
      {risk && !loading && (
        <div className={`card border ${levelColors?.border} p-5 space-y-4 animate-fade-in`}>
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <LuShieldCheck className={`w-4 h-4 ${levelColors?.text}`} />
                AI Risk Assessment
              </h3>
              {tokenData && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                  {tokenData.name} ({tokenData.symbol})
                </p>
              )}
            </div>
            <div className="text-right">
              <RiskGauge score={risk.score} />
            </div>
          </div>

          {/* Level Badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${levelColors?.bg} ${levelColors?.border} border`}>
            <span className={`text-xs font-bold ${levelColors?.text}`}>{risk.level} RISK</span>
          </div>

          {/* Factors */}
          <div className="space-y-2">
            <h4 className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Risk Factors</h4>
            {risk.factors.map((factor, i) => {
              const fColors = LEVEL_COLORS[factor.risk] || LEVEL_COLORS.MEDIUM;
              return (
                <div key={i} className={`px-3 py-2 rounded-lg ${fColors.bg} border ${fColors.border}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">{factor.name}</span>
                    <span className={`text-[10px] font-bold ${fColors.text}`}>{factor.risk}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{factor.detail}</p>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{risk.summary}</p>

          {/* Recommendation */}
          {recConfig && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10`}>
              <recConfig.icon className={`w-4 h-4 ${recConfig.color}`} />
              <span className={`text-xs font-medium ${recConfig.color}`}>{recConfig.label}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
