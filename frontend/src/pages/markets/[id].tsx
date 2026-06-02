"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import MarketCard from '../../components/MarketCard';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

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

function SkeletonDetail() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-8 bg-white/5 rounded w-3/4 mb-3 animate-pulse" />
      <div className="h-4 bg-white/5 rounded w-1/3 mb-6 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-40 bg-white/5 rounded animate-pulse" />
        <div className="h-40 bg-white/5 rounded animate-pulse" />
        <div className="h-40 bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function MarketDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [market, setMarket] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { address } = useAccount();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      // Try matching contractAddress first, then id
      const { data: byContract } = await supabase
        .from('Market')
        .select('*')
        .eq('contractAddress', String(id))
        .limit(1);

      if (mounted && byContract && byContract.length > 0) {
        setMarket(byContract[0]);
        setLoading(false);
        return;
      }

      const { data: byId } = await supabase
        .from('Market')
        .select('*')
        .eq('id', String(id))
        .limit(1);

      if (mounted && byId && byId.length > 0) {
        setMarket(byId[0]);
      } else if (mounted) {
        setMarket(null);
      }
      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [id]);

  const scrollToCard = () => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (loading) return <SkeletonDetail />;
  if (!market) return <div className="max-w-3xl mx-auto px-4 py-8">Market not found</div>;

  const yes = Number(market.yesPool || '0') / 1e18;
  const no = Number(market.noPool || '0') / 1e18;
  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;

  // Map DB fields to MarketCard expectation
  const mapped = {
    id: market.id,
    question: market.question,
    tokenAddress: market.tokenAddress || '',
    tokenName: market.tokenName || '',
    tokenSymbol: market.stockTicker || 'TOKEN',
    tokenDecimals: market.tokenDecimals ?? 18,
    contractCreator: market.creatorAddress || '',
    totalSupply: market.latestSupply || market.initialSupply || '0',
    threshold: Number(market.threshold) || 0,
    deadline: new Date(market.deadline).valueOf(),
    yesPool: yes,
    noPool: no,
    bets: [],
    resolved: market.resolved,
    reached: market.reached,
    createdAt: new Date(market.createdAt).valueOf(),
    marketContract: market.contractAddress,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">{market.question}</h1>
        <div className="flex items-center gap-4 text-sm text-[var(--text-muted)]">
          <div>By {truncate(market.creatorAddress)}</div>
          <div>•</div>
          <div>Time: {timeRemainingFrom(market.deadline)}</div>
          <div>•</div>
          <div>Total: {total.toFixed(4)} ETH</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-[var(--text-muted)]">Odds</div>
              <div className="text-sm font-semibold text-white">YES {yesPct}%</div>
            </div>
            <div className="h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div className="bg-emerald-500" style={{ width: `${yesPct}%` }} />
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <ConnectButton.Custom>
              {({ mounted, openConnectModal }) => (
                  <button
                    onClick={() => {
                      if (!mounted) return;
                      try { sessionStorage.setItem('pumpx.focusBet', JSON.stringify({ marketId: market.contractAddress || market.id, ts: Date.now() })); } catch {}
                      if (!openConnectModal) return scrollToCard();
                      openConnectModal();
                    }}
                  className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 flex-1 py-3"
                >
                  Bet YES
                </button>
              )}
            </ConnectButton.Custom>
            <ConnectButton.Custom>
              {({ mounted, openConnectModal }) => (
                  <button
                    onClick={() => {
                      if (!mounted) return;
                      try { sessionStorage.setItem('pumpx.focusBet', JSON.stringify({ marketId: market.contractAddress || market.id, ts: Date.now() })); } catch {}
                      if (!openConnectModal) return scrollToCard();
                      openConnectModal();
                    }}
                  className="btn-primary !bg-red-600 hover:!bg-red-500 flex-1 py-3"
                >
                  Bet NO
                </button>
              )}
            </ConnectButton.Custom>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
              <div className="text-xs text-[var(--text-muted)]">Market created</div>
              <div className="font-mono text-sm text-white">{new Date(market.createdAt).toLocaleString()}</div>
            </div>
            <div className="p-4 bg-[var(--bg-elevated)] rounded-lg">
              <div className="text-xs text-[var(--text-muted)]">Contract</div>
              <div className="font-mono text-sm text-white">{truncate(market.contractAddress)}</div>
            </div>
          </div>
        </div>

        <div ref={cardRef}>
          <MarketCard market={mapped} />
        </div>
      </div>
    </div>
  );
}
