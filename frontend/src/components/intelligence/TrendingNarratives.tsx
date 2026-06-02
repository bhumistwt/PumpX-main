import React from 'react';
import { LuTrendingUp, LuTrendingDown, LuMinus } from 'react-icons/lu';
import type { NarrativeCard } from '../../lib/ai/narrativeEngine';

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'UP') return <LuTrendingUp className="w-4 h-4 text-emerald-400" />;
  if (direction === 'DOWN') return <LuTrendingDown className="w-4 h-4 text-red-400" />;
  return <LuMinus className="w-4 h-4 text-[var(--text-muted)]" />;
}

function sentimentColor(score: number): string {
  if (score >= 60) return 'text-emerald-400';
  if (score <= 40) return 'text-red-400';
  return 'text-amber-400';
}

export function NarrativesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse h-28" />
      ))}
    </div>
  );
}

export default function TrendingNarratives({
  narratives,
  loading,
}: {
  narratives: NarrativeCard[];
  loading: boolean;
}) {
  if (loading) return <NarrativesSkeleton />;

  if (narratives.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--text-muted)]">
        No narrative trends yet. Market data will populate this section as activity grows.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {narratives.map((n) => (
        <div key={n.id} className="card p-4 hover:border-[var(--accent-primary)]/30 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--text-primary)]">{n.name}</h3>
            <TrendIcon direction={n.trendDirection} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[var(--text-muted)]">Growth</p>
              <p className="font-mono-data text-[var(--text-primary)]">
                {n.mentionGrowth >= 0 ? '+' : ''}
                {n.mentionGrowth.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Sentiment</p>
              <p className={`font-mono-data ${sentimentColor(n.sentiment)}`}>{n.sentiment}%</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Markets</p>
              <p className="font-mono-data text-[var(--text-primary)]">{n.marketCount}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)]">Trend</p>
              <p className="font-medium text-[var(--text-secondary)]">{n.trendDirection}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
