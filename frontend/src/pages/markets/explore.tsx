"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/router';

function truncate(addr?: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeRemainingFrom(deadline: string | Date) {
  const d = new Date(deadline).getTime();
  const now = Date.now();
  const remaining = d - now;
  if (remaining <= 0) return 'Expired';
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return `${days}d ${hours}h ${mins}m`;
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-5 bg-white/5 rounded w-3/4 mb-3" />
      <div className="h-3 bg-white/5 rounded w-1/3 mb-4" />
      <div className="flex items-center justify-between">
        <div className="h-8 bg-white/5 rounded w-24" />
        <div className="h-8 bg-white/5 rounded w-16" />
      </div>
    </div>
  );
}

export default function ExploreMarkets() {
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('Market')
        .select('id,question,yesPool,noPool,deadline,creatorAddress,contractAddress,createdAt,resolved')
        .eq('resolved', false)
        .gt('deadline', now)
        .order('createdAt', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Supabase error', error);
        if (mounted) setMarkets([]);
      } else if (mounted) {
        setMarkets(data ?? []);
      }
      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleVote = (m: any, side: 'YES' | 'NO', openConnectModal?: () => void) => {
    const id = m.contractAddress || m.id;
    if (!address) {
      // set flag so MarketCard will focus the bet input after connect
      try { sessionStorage.setItem('pumpx.focusBet', JSON.stringify({ marketId: id, ts: Date.now() })); } catch {}
      openConnectModal?.();
      return;
    }
    // If connected, navigate to market detail
    router.push(`/markets/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Explore Markets</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Public list of currently open markets. No login required to browse.</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {markets.map((m) => {
            const yes = Number(m.yesPool || '0') / 1e18;
            const no = Number(m.noPool || '0') / 1e18;
            const total = yes + no;
            const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
            return (
              <div key={m.id} className="card">
                <h3 className="text-base font-semibold text-white line-clamp-2 mb-2">
                  <Link href={`/markets/${m.contractAddress || m.id}`}>{m.question}</Link>
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-[var(--text-muted)]">By {truncate(m.creatorAddress)}</div>
                  <div className="text-xs text-[var(--text-muted)]">{timeRemainingFrom(m.deadline)}</div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-emerald-400 font-medium">YES {yesPct}%</span>
                    <span className="text-red-400 font-medium">NO {100 - yesPct}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden flex mb-2">
                    <div className="bg-emerald-500" style={{ width: `${yesPct}%` }} />
                    <div className="bg-red-500" style={{ width: `${100 - yesPct}%` }} />
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">Total: {total.toFixed(4)} ETH</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <ConnectButton.Custom>
                    {({ mounted, openConnectModal }) => (
                      <button
                        onClick={() => handleVote(m, 'YES', openConnectModal)}
                        className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 text-sm py-2.5"
                      >
                        Bet YES
                      </button>
                    )}
                  </ConnectButton.Custom>

                  <ConnectButton.Custom>
                    {({ mounted, openConnectModal }) => (
                      <button
                        onClick={() => handleVote(m, 'NO', openConnectModal)}
                        className="btn-primary !bg-red-600 hover:!bg-red-500 text-sm py-2.5"
                      >
                        Bet NO
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
