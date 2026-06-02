import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useEnsName } from 'wagmi';
import { LuWallet, LuTarget, LuSparkles } from 'react-icons/lu';
import { truncateAddress, isValidEthAddress } from '../../lib/addresses';
import type { WalletDNAStats } from '../../lib/walletDNA';
import type { WalletAiInsights } from '../../lib/ai/walletInsights';
import { EmptyState } from '../../components/ui/primitives';

function WalletIdentity({ address }: { address: string }) {
  const { data: ensName } = useEnsName({ address: address as `0x${string}` });
  const display = ensName || truncateAddress(address);

  return (
    <div>
      <p className="text-xl font-bold text-white">{display}</p>
      {ensName && (
        <p className="text-xs font-mono text-[var(--text-muted)] mt-1">{truncateAddress(address)}</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-lg font-bold font-mono-data mt-1 text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6 animate-pulse">
      <div className="h-24 card" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 card" />
        ))}
      </div>
      <div className="h-40 card" />
    </div>
  );
}

const STYLE_COLORS: Record<string, string> = {
  Sharp: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  Whale: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
  Degen: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  Casual: 'text-[var(--text-muted)] bg-white/5 border-white/10',
};

export default function WalletDNAPage() {
  const router = useRouter();
  const { address: rawAddress } = router.query;
  const address = typeof rawAddress === 'string' ? rawAddress.toLowerCase() : '';

  const [stats, setStats] = useState<WalletDNAStats | null>(null);
  const [aiInsights, setAiInsights] = useState<WalletAiInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || !address) return;
    if (!isValidEthAddress(address)) {
      setError('Invalid wallet address');
      setLoading(false);
      return;
    }

    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/wallet/${address}`);
        if (!res.ok) throw new Error('Failed to load wallet data');
        const data = await res.json();
        if (!mounted) return;
        setStats(data.stats);
        setAiInsights(data.aiInsights);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [router.isReady, address]);

  if (!router.isReady || loading) return <PageSkeleton />;

  if (error || !isValidEthAddress(address)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState title="Invalid wallet" description={error || 'Provide a valid 0x address.'} />
      </div>
    );
  }

  if (!stats || stats.totalBets === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <EmptyState
          title="No activity"
          description="No prediction activity found for this wallet."
          icon={<LuWallet className="w-8 h-8 text-[var(--text-muted)]" />}
        />
      </div>
    );
  }

  const styleCls = STYLE_COLORS[stats.tradingStyle] ?? STYLE_COLORS.Casual;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-fade-in space-y-8">
      {/* Profile card */}
      <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)]/30 to-blue-500/30 flex items-center justify-center">
            <LuWallet className="w-7 h-7 text-[var(--accent-primary)]" />
          </div>
          <WalletIdentity address={address} />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styleCls}`}>
            {stats.tradingStyle}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-[var(--text-secondary)] capitalize">
            {stats.activityLevel}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total markets" value={String(stats.totalMarkets)} />
        <StatCard label="Win rate" value={`${stats.winRate}%`} />
        <StatCard label="Total staked" value={`${stats.totalStakedEth} ETH`} />
        <StatCard label="ROI" value={`${stats.roiPercent >= 0 ? '+' : ''}${stats.roiPercent}%`} />
        <StatCard label="Favorite sector" value={stats.favoriteSector} />
        <StatCard label="Total bets" value={String(stats.totalBets)} />
      </div>

      {/* AI insights */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LuSparkles className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="font-semibold text-white">AI Personality</h2>
        </div>

        {stats.totalBets < 5 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Place at least 5 bets to unlock AI personality insights.
          </p>
        ) : !aiInsights?.available ? (
          <p className="text-sm text-[var(--text-muted)]">AI insights unavailable</p>
        ) : (
          <>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-4">{aiInsights.summary}</p>
            <ul className="space-y-2">
              {aiInsights.bullets.map((b, i) => (
                <li key={i} className="text-sm text-[var(--text-secondary)] flex gap-2">
                  <span className="text-[var(--accent-primary)]">•</span>
                  {b}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Recent markets */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LuTarget className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white">Recent markets</h2>
        </div>

        {stats.recentMarkets.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No recent market activity.</p>
        ) : (
          <div className="space-y-3">
            {stats.recentMarkets.map((m) => (
              <Link
                key={m.marketAddress}
                href={`/markets/${m.marketAddress}`}
                className="block p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-sm text-white line-clamp-2 flex-1">{m.question}</p>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className={m.side === 'YES' ? 'text-emerald-400' : 'text-red-400'}>{m.side}</span>
                    <span className="font-mono text-[var(--text-muted)]">
                      {(Number(m.amount) / 1e18).toFixed(4)} ETH
                    </span>
                    <span className="capitalize text-[var(--text-muted)]">{m.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-center text-[var(--text-muted)]">
        <Link href="/leaderboard" className="text-[var(--accent-primary)] hover:underline">
          View PumpScore leaderboard
        </Link>
      </p>
    </div>
  );
}
