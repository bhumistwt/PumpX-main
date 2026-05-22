/**
 * PumpX — Portfolio Hedging Mode Page
 *
 * Frames prediction markets as risk management / portfolio insurance tools.
 * "Hedge against supply inflation" — bet NO to protect if supply dilutes.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import {
  LuShieldCheck,
  LuTrendingDown,
  LuTrendingUp,
  LuAlertTriangle,
  LuArrowRight,
  LuTarget,
  LuBarChart3,
  LuInfo,
  LuWallet,
} from 'react-icons/lu';
import { marketsApi, type MarketData } from '../lib/apiClient';
import { RiskScore } from '../components/RiskScore';

interface HedgeOpportunity {
  market: MarketData;
  hedgeType: 'supply_inflation' | 'supply_deflation' | 'deadline_risk';
  description: string;
  action: 'BET_NO' | 'BET_YES';
  rationale: string;
  urgency: 'low' | 'medium' | 'high';
}

function categorizeHedge(market: MarketData): HedgeOpportunity | null {
  const deadline = new Date(market.deadline).getTime();
  const daysLeft = Math.floor((deadline - Date.now()) / 86_400_000);

  if (daysLeft < 0) return null; // expired

  const yesWei = BigInt(market.yesPool);
  const noWei = BigInt(market.noPool);
  const totalWei = yesWei + noWei;
  const yesRatio = totalWei > 0n ? Number((yesWei * 10000n) / totalWei) / 100 : 50;

  // If market is heavily YES (bullish on supply growth) → hedge by betting NO
  if (yesRatio > 65) {
    return {
      market,
      hedgeType: 'supply_inflation',
      description: `Hedge against ${market.question.slice(0, 60)}`,
      action: 'BET_NO',
      rationale: `Market is ${yesRatio.toFixed(0)}% bullish. If supply doesn't reach the threshold, your NO position pays off as insurance.`,
      urgency: daysLeft < 3 ? 'high' : daysLeft < 7 ? 'medium' : 'low',
    };
  }

  // If market is heavily NO → hedge by betting YES
  if (yesRatio < 35) {
    return {
      market,
      hedgeType: 'supply_deflation',
      description: `Protect against unexpected supply growth for ${market.question.slice(0, 60)}`,
      action: 'BET_YES',
      rationale: `Market is ${(100 - yesRatio).toFixed(0)}% bearish. A YES bet hedges against surprise supply increases.`,
      urgency: daysLeft < 3 ? 'high' : daysLeft < 7 ? 'medium' : 'low',
    };
  }

  // Near-deadline markets with balanced sentiment = deadline risk hedge
  if (daysLeft < 3 && totalWei > 0n) {
    return {
      market,
      hedgeType: 'deadline_risk',
      description: `Expiring soon: ${market.question.slice(0, 60)}`,
      action: yesRatio > 50 ? 'BET_NO' : 'BET_YES',
      rationale: `Market expires in ${daysLeft < 1 ? 'less than a day' : `${daysLeft} days`}. The contrarian position is cheap insurance.`,
      urgency: 'high',
    };
  }

  return null;
}

const URGENCY_COLORS = {
  low: { bg: 'bg-emerald-400/5', border: 'border-emerald-400/15', text: 'text-emerald-400' },
  medium: { bg: 'bg-yellow-400/5', border: 'border-yellow-400/15', text: 'text-yellow-400' },
  high: { bg: 'bg-red-400/5', border: 'border-red-400/15', text: 'text-red-400' },
};

function HedgeCard({ hedge }: { hedge: HedgeOpportunity }) {
  const colors = URGENCY_COLORS[hedge.urgency];
  const ActionIcon = hedge.action === 'BET_NO' ? LuTrendingDown : LuTrendingUp;
  const actionColor = hedge.action === 'BET_NO' ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className={`card ${colors.border} border p-4 space-y-3 hover:border-[var(--accent-primary)]/30 transition-colors`}>
      {/* Urgency badge */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border font-medium ${colors.text}`}>
          {hedge.urgency === 'high' && <LuAlertTriangle className="w-3 h-3" />}
          {hedge.urgency.toUpperCase()} URGENCY
        </span>
        <span className={`flex items-center gap-1 text-xs font-medium ${actionColor}`}>
          <ActionIcon className="w-3.5 h-3.5" />
          {hedge.action.replace('_', ' ')}
        </span>
      </div>

      {/* Description */}
      <h4 className="text-sm font-medium text-white">{hedge.description}</h4>

      {/* Rationale */}
      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{hedge.rationale}</p>

      {/* Market info */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-2 border-t border-white/5">
        <span className="font-mono">{hedge.market.contractAddress.slice(0, 10)}...</span>
        <span>{new Date(hedge.market.deadline).toLocaleDateString()}</span>
      </div>

      {/* Action button */}
      <Link
        href={`/markets/view?address=${hedge.market.contractAddress}`}
        className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-lg text-xs text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
      >
        <LuShieldCheck className="w-3.5 h-3.5" />
        Place Hedge
        <LuArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

export default function HedgePage() {
  const { isConnected } = useAccount();
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRiskAnalysis, setShowRiskAnalysis] = useState(false);

  useEffect(() => {
    marketsApi.list({ status: 'active', limit: 100 })
      .then(res => setMarkets(res.markets))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, []);

  const hedgeOpportunities = useMemo(() =>
    markets
      .map(categorizeHedge)
      .filter((h): h is HedgeOpportunity => h !== null)
      .sort((a, b) => {
        const urgencyOrder = { high: 0, medium: 1, low: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }),
    [markets]
  );

  const stats = useMemo(() => ({
    total: hedgeOpportunities.length,
    high: hedgeOpportunities.filter(h => h.urgency === 'high').length,
    medium: hedgeOpportunities.filter(h => h.urgency === 'medium').length,
    low: hedgeOpportunities.filter(h => h.urgency === 'low').length,
  }), [hedgeOpportunities]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
            <LuShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Portfolio Hedging</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Use prediction markets as portfolio insurance against token supply risks
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card p-4 border border-blue-500/10">
        <div className="flex items-start gap-3">
          <LuInfo className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white">How Hedging Works on PumpX</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-[var(--text-muted)]">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                <p>If you hold tokens and fear supply inflation diluting your position, <span className="text-red-400 font-medium">bet NO</span> on a supply milestone market.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                <p>If supply hits the threshold (bad for your position), your NO bet loses — but your tokens are still worth something at the new supply.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                <p>If supply doesn&apos;t hit the threshold, your NO bet wins — offsetting any other losses. <span className="text-emerald-400 font-medium">That&apos;s your hedge.</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Opportunities</p>
          <p className="text-xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="card p-4 text-center border-red-400/10">
          <p className="text-[10px] text-red-400 uppercase tracking-wider">High Urgency</p>
          <p className="text-xl font-bold text-red-400 mt-1">{stats.high}</p>
        </div>
        <div className="card p-4 text-center border-yellow-400/10">
          <p className="text-[10px] text-yellow-400 uppercase tracking-wider">Medium</p>
          <p className="text-xl font-bold text-yellow-400 mt-1">{stats.medium}</p>
        </div>
        <div className="card p-4 text-center border-emerald-400/10">
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider">Low</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{stats.low}</p>
        </div>
      </div>

      {/* Risk Analysis Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowRiskAnalysis(!showRiskAnalysis)}
          className={`text-xs px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            showRiskAnalysis
              ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
              : 'border-white/10 text-[var(--text-muted)] hover:text-white'
          }`}
        >
          <LuShieldCheck className="w-3.5 h-3.5" />
          AI Token Risk Scanner
        </button>
      </div>

      {/* Risk Analysis Panel */}
      {showRiskAnalysis && (
        <div className="card p-5 border border-[var(--accent-primary)]/10">
          <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <LuTarget className="w-4 h-4 text-[var(--accent-primary)]" />
            Analyze Token Risk
          </h3>
          <RiskScore />
        </div>
      )}

      {/* Hedge Opportunities */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-4 h-48 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : hedgeOpportunities.length === 0 ? (
        <div className="text-center py-16 card">
          <LuShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-medium text-white mb-1">No Hedge Opportunities</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            All markets have balanced sentiment. New opportunities appear when markets become skewed.
          </p>
          <Link href="/markets" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2">
            Create Market <LuArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hedgeOpportunities.map((hedge, i) => (
            <HedgeCard key={i} hedge={hedge} />
          ))}
        </div>
      )}
    </div>
  );
}
