/**
 * PumpX — Conditional Markets Page
 *
 * Visualizes market chains — multiple milestones on the same token
 * that form a progression (e.g. 1M → 10M → 100M supply thresholds).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LuGitBranch,
  LuArrowRight,
  LuCheck,
  LuX,
  LuClock,
  LuTrendingUp,
  LuTrendingDown,
  LuBarChart3,
} from 'react-icons/lu';

interface ChainMarket {
  address: string;
  question: string;
  threshold: string;
  deadline: string;
  yesPool: string;
  noPool: string;
  resolved: boolean;
  reached: boolean;
  betsCount: number;
}

interface MarketChain {
  tokenAddress: string;
  ticker: string | null;
  markets: ChainMarket[];
  stage: string;
}

function formatThreshold(threshold: string): string {
  const num = Number(threshold);
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return threshold;
}

function ChainCard({ chain }: { chain: MarketChain }) {
  return (
    <div className="card p-5 space-y-4">
      {/* Chain Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LuGitBranch className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="text-sm font-medium text-white">
            {chain.ticker ? `$${chain.ticker}` : chain.tokenAddress.slice(0, 10) + '...'} Chain
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20">
            {chain.stage}
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          {chain.tokenAddress.slice(0, 8)}...{chain.tokenAddress.slice(-6)}
        </span>
      </div>

      {/* Milestones Timeline */}
      <div className="relative">
        {/* Connection line */}
        <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gradient-to-b from-[var(--accent-primary)]/40 to-white/5" />

        <div className="space-y-3">
          {chain.markets.map((market, idx) => {
            const yesWei = BigInt(market.yesPool);
            const noWei = BigInt(market.noPool);
            const totalWei = yesWei + noWei;
            const yesRatio = totalWei > 0n ? Number((yesWei * 10000n) / totalWei) / 100 : 50;
            const totalEth = Number(totalWei) / 1e18;
            const isExpired = new Date(market.deadline).getTime() < Date.now();

            let StatusIcon = LuClock;
            let statusColor = 'text-yellow-400';
            let statusBg = 'bg-yellow-400/10';
            if (market.resolved && market.reached) {
              StatusIcon = LuCheck;
              statusColor = 'text-emerald-400';
              statusBg = 'bg-emerald-400/10';
            } else if (market.resolved || isExpired) {
              StatusIcon = LuX;
              statusColor = 'text-red-400';
              statusBg = 'bg-red-400/10';
            }

            return (
              <Link key={market.address} href={`/markets/view?address=${market.address}`}>
                <div className="relative flex items-start gap-3 ml-1 group cursor-pointer">
                  {/* Milestone dot */}
                  <div className={`relative z-10 w-7 h-7 rounded-full ${statusBg} border border-white/10 flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${statusColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-[var(--bg-elevated)] border border-white/5 rounded-lg p-3 group-hover:border-[var(--accent-primary)]/20 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">Stage {idx + 1}</span>
                        <span className="text-[10px] font-mono text-[var(--accent-primary)]">
                          {formatThreshold(market.threshold)}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">{market.betsCount} bets</span>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] mb-2 line-clamp-1">{market.question}</p>

                    {/* Sentiment bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                        style={{ width: `${yesRatio}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9px]">
                      <span className="text-emerald-400">{yesRatio.toFixed(0)}% YES</span>
                      <span className="text-[var(--text-muted)]">{totalEth.toFixed(4)} ETH</span>
                      <span className="text-red-400">{(100 - yesRatio).toFixed(0)}% NO</span>
                    </div>
                  </div>

                  {/* Arrow to next */}
                  {idx < chain.markets.length - 1 && (
                    <div className="absolute left-3.5 -bottom-3 text-[var(--text-muted)]">
                      <LuArrowRight className="w-3 h-3 rotate-90" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ConditionalMarketsPage() {
  const [chains, setChains] = useState<MarketChain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets/conditional')
      .then(res => res.json())
      .then(data => setChains(data.chains || []))
      .catch(() => setChains([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
            <LuGitBranch className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Conditional Markets</h1>
            <p className="text-xs text-[var(--text-muted)]">
              Multi-stage market chains — milestones that progress on the same token
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card p-4 border border-purple-500/10">
        <div className="flex items-start gap-3">
          <LuGitBranch className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-white mb-1">Market Chains</h3>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              When multiple markets track the same token at different supply thresholds, they form a chain.
              For example: &quot;Will PEPE reach 1B?&quot; → &quot;Will PEPE reach 10B?&quot; → &quot;Will PEPE reach 100B?&quot;.
              If the first milestone is reached, the next becomes more likely — creating cascading prediction opportunities.
            </p>
          </div>
        </div>
      </div>

      {/* Chains */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="card p-5 h-64 animate-pulse bg-white/5" />
          ))}
        </div>
      ) : chains.length === 0 ? (
        <div className="text-center py-16 card">
          <LuGitBranch className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
          <h3 className="text-lg font-medium text-white mb-1">No Market Chains Found</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Create multiple markets on the same token with different thresholds to form a chain
          </p>
          <Link href="/markets" className="btn-primary text-sm px-4 py-2 inline-flex items-center gap-2">
            Create Market <LuArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {chains.map((chain, i) => (
            <ChainCard key={i} chain={chain} />
          ))}
        </div>
      )}
    </div>
  );
}
