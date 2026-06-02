import React from 'react';
import { truncateAddress } from '../../lib/addresses';

export interface WhaleAlertItem {
  id: string;
  walletAddress: string;
  action: string;
  tokenAddress: string;
  amountEth: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function actionBadge(action: string): { label: string; className: string } {
  if (action.includes('YES')) {
    return { label: action.replace('_', ' '), className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  if (action.includes('NO')) {
    return { label: action.replace('_', ' '), className: 'bg-red-500/15 text-red-400 border-red-500/30' };
  }
  return { label: action, className: 'bg-white/5 text-[var(--text-muted)] border-white/10' };
}

export function WhaleFeedSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function WhaleActivityFeed({
  alerts,
  loading,
  limit = 10,
}: {
  alerts: WhaleAlertItem[];
  loading: boolean;
  limit?: number;
}) {
  if (loading) return <WhaleFeedSkeleton />;

  const shown = alerts.slice(0, limit);

  if (shown.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--text-muted)]">
        No whale activity yet. Large bets (&gt;0.1 ETH) will appear here automatically.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shown.map((a) => {
        const badge = actionBadge(a.action);
        return (
          <div
            key={a.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-xs text-[var(--accent-primary)] shrink-0">
                {truncateAddress(a.walletAddress)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${badge.className}`}>
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] shrink-0">
              <span className="font-mono-data text-[var(--text-primary)]">{a.amountEth} ETH</span>
              <span>{timeAgo(a.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
