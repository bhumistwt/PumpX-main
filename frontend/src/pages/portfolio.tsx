import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import {
  LuWallet,
  LuExternalLink,
  LuRefreshCw,
  LuTrophy,
} from 'react-icons/lu';
import { useAuth } from '../hooks/useAuth';
import { PageHeader, Badge, EmptyState } from '../components/ui/primitives';
import { MILESTONE_MARKET_ABI } from '../constants/contracts';

type PositionStatus = 'active' | 'won' | 'lost' | 'expired';

interface PortfolioPosition {
  betId: string;
  side: 'YES' | 'NO';
  amount: string;
  txHash: string;
  chainId: number;
  createdAt: string;
  claimed: boolean;
  status: PositionStatus;
  estimatedReturn: string;
  market: {
    contractAddress: string;
    question: string | null;
    resolved: boolean;
    reached: boolean | null;
    deadline: string;
    yesPool: string;
    noPool: string;
    chainId: number;
  };
}

interface PortfolioResponse {
  address: string;
  totalBets: number;
  totalInvestmentEth: string;
  totalReturnEth: string;
  pnlEth: string;
  pnlPercent: string;
  positions: PortfolioPosition[];
}

function display(value: string | null | undefined): string {
  if (value == null || value === '') return '--';
  return value;
}

function formatEthWei(wei: string | null | undefined): string {
  if (!wei) return '--';
  try {
    const n = Number(formatEther(BigInt(wei)));
    if (!Number.isFinite(n)) return '--';
    return `${n.toFixed(4)} ETH`;
  } catch {
    return '--';
  }
}

function statusBadgeVariant(status: PositionStatus): 'active' | 'success' | 'danger' | 'warning' {
  switch (status) {
    case 'won':
      return 'success';
    case 'lost':
      return 'danger';
    case 'expired':
      return 'warning';
    default:
      return 'active';
  }
}

function statusLabel(status: PositionStatus): string {
  switch (status) {
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    case 'expired':
      return 'Expired';
    default:
      return 'Active';
  }
}

function outcomeLabel(pos: PortfolioPosition): string {
  const m = pos.market;
  if (!m.resolved) return '--';
  if (m.reached == null) return '--';
  return m.reached ? 'YES' : 'NO';
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-4 bg-white/5 rounded w-2/3 mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-8 bg-white/5 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ClaimButton({
  contractAddress,
  onClaimed,
}: {
  contractAddress: string;
  onClaimed: () => void;
}) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) onClaimed();
  }, [isSuccess, onClaimed]);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          writeContract({
            address: contractAddress as `0x${string}`,
            abi: MILESTONE_MARKET_ABI,
            functionName: 'claim',
          })
        }
        className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
      >
        {isPending ? 'Claiming…' : 'Claim'}
      </button>
      {error && (
        <span className="text-[10px] text-red-400 max-w-[140px] text-right leading-tight">
          {error.message.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

function usePositionDisplay(pos: PortfolioPosition) {
  const m = pos.market;
  return {
    marketName: display(m.question),
    canClaim: pos.status === 'won' && !pos.claimed && m.resolved && !!m.contractAddress,
    contractAddress: m.contractAddress,
  };
}

function PositionMobileCard({
  pos,
  onRefresh,
}: {
  pos: PortfolioPosition;
  onRefresh: () => void;
}) {
  const m = pos.market;
  const { marketName, canClaim, contractAddress } = usePositionDisplay(pos);

  return (
    <div className="card p-4 space-y-3">
      <p className="font-medium text-sm text-[var(--text-primary)] line-clamp-2">{marketName}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--text-muted)]">Position</span>
          <p className={`font-semibold mt-0.5 ${pos.side === 'YES' ? 'text-emerald-400' : 'text-red-400'}`}>
            {display(pos.side)}
          </p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Staked</span>
          <p className="font-mono-data mt-0.5">{formatEthWei(pos.amount)}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Status</span>
          <p className="mt-1">
            <Badge variant={statusBadgeVariant(pos.status)}>{statusLabel(pos.status)}</Badge>
          </p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Outcome</span>
          <p className="font-mono-data mt-0.5">{outcomeLabel(pos)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <Link
          href={`/markets/${m.contractAddress}`}
          className="text-xs text-[var(--accent-primary)] hover:underline"
        >
          View market
        </Link>
        {canClaim ? (
          <ClaimButton contractAddress={contractAddress} onClaimed={onRefresh} />
        ) : pos.claimed ? (
          <span className="text-xs text-[var(--text-muted)]">Claimed</span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">--</span>
        )}
      </div>
    </div>
  );
}

function PositionTableRow({
  pos,
  onRefresh,
}: {
  pos: PortfolioPosition;
  onRefresh: () => void;
}) {
  const m = pos.market;
  const { marketName, canClaim, contractAddress } = usePositionDisplay(pos);

  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02]">
      <td className="py-4 pr-4 text-sm text-[var(--text-primary)] max-w-xs">
        <Link href={`/markets/${m.contractAddress}`} className="hover:text-[var(--accent-primary)] line-clamp-2">
          {marketName}
        </Link>
      </td>
      <td className="py-4 px-3">
        <span className={`text-sm font-semibold ${pos.side === 'YES' ? 'text-emerald-400' : 'text-red-400'}`}>
          {display(pos.side)}
        </span>
      </td>
      <td className="py-4 px-3 font-mono-data text-sm">{formatEthWei(pos.amount)}</td>
      <td className="py-4 px-3">
        <Badge variant={statusBadgeVariant(pos.status)}>{statusLabel(pos.status)}</Badge>
      </td>
      <td className="py-4 px-3 font-mono-data text-sm">{outcomeLabel(pos)}</td>
      <td className="py-4 pl-3 text-right">
        {canClaim ? (
          <ClaimButton contractAddress={contractAddress} onClaimed={onRefresh} />
        ) : pos.claimed ? (
          <span className="text-xs text-[var(--text-muted)]">Claimed</span>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">--</span>
        )}
      </td>
    </tr>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const { isConnected, isConnecting } = useAccount();
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnecting) return;
    if (!isConnected) {
      router.replace(`/login?callbackUrl=${encodeURIComponent('/portfolio')}`);
    }
  }, [isConnected, isConnecting, router]);

  const loadPortfolio = useCallback(async () => {
    if (!user?.isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/portfolio');
      if (res.status === 401) {
        router.replace(`/login?callbackUrl=${encodeURIComponent('/portfolio')}`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load portfolio');
      }
      const json: PortfolioResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portfolio');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.isLoggedIn, router]);

  useEffect(() => {
    if (authLoading || !isConnected) return;
    if (!user?.isLoggedIn) {
      setLoading(false);
      return;
    }
    loadPortfolio();
  }, [authLoading, isConnected, user?.isLoggedIn, loadPortfolio]);

  if (!isConnected && !isConnecting) {
    return null;
  }

  const needsSignIn = isConnected && !authLoading && !user?.isLoggedIn;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        icon={<LuWallet className="w-5 h-5" />}
        title="Portfolio"
        subtitle="Your prediction market positions and claimable winnings"
        action={
          user?.isLoggedIn ? (
            <button
              type="button"
              onClick={loadPortfolio}
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <LuRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          ) : undefined
        }
      />

      {needsSignIn && (
        <EmptyState
          title="Sign in to view positions"
          description="Connect your wallet and complete Sign-In With Ethereum to load your bets from the protocol."
          action={
            <Link href="/login?callbackUrl=/portfolio" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
              <LuWallet className="w-4 h-4" />
              Sign In
            </Link>
          }
        />
      )}

      {!needsSignIn && user?.isLoggedIn && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse h-20" />
              ))
            ) : (
              <>
                <div className="card p-4 text-center sm:text-left">
                  <p className="text-xs text-[var(--text-muted)]">Total bets</p>
                  <p className="text-xl font-bold font-mono-data mt-1">
                    {data?.totalBets != null ? data.totalBets : '--'}
                  </p>
                </div>
                <div className="card p-4 text-center sm:text-left">
                  <p className="text-xs text-[var(--text-muted)]">Staked</p>
                  <p className="text-xl font-bold font-mono-data mt-1">
                    {data?.totalInvestmentEth != null ? `${data.totalInvestmentEth} ETH` : '--'}
                  </p>
                </div>
                <div className="card p-4 text-center sm:text-left">
                  <p className="text-xs text-[var(--text-muted)]">Est. return</p>
                  <p className="text-xl font-bold font-mono-data mt-1">
                    {data?.totalReturnEth != null ? `${data.totalReturnEth} ETH` : '--'}
                  </p>
                </div>
                <div className="card p-4 text-center sm:text-left">
                  <p className="text-xs text-[var(--text-muted)]">P&amp;L</p>
                  <p
                    className={`text-xl font-bold font-mono-data mt-1 ${
                      data?.pnlEth && parseFloat(data.pnlEth) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {data?.pnlEth != null ? `${data.pnlEth} ETH` : '--'}
                    {data?.pnlPercent != null && (
                      <span className="text-sm font-normal text-[var(--text-muted)] ml-1">
                        ({data.pnlPercent}%)
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="card p-4 border border-red-500/30 bg-red-500/10 text-sm text-red-400">{error}</div>
          )}

          {loading ? (
            <PortfolioSkeleton />
          ) : !data?.positions?.length ? (
            <EmptyState
              title="No bets yet"
              description="Place your first YES or NO bet on an active market to see positions here."
              icon={<LuTrophy className="w-8 h-8 text-[var(--text-muted)]" />}
              action={
                <Link href="/markets/explore" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
                  Explore Markets
                  <LuExternalLink className="w-4 h-4" />
                </Link>
              }
            />
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {data.positions.map((pos) => (
                  <PositionMobileCard key={pos.betId} pos={pos} onRefresh={loadPortfolio} />
                ))}
              </div>

              <div className="hidden md:block card overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-3 pr-4 font-semibold">Market</th>
                      <th className="py-3 px-3 font-semibold">Position</th>
                      <th className="py-3 px-3 font-semibold">Staked</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold">Outcome</th>
                      <th className="py-3 pl-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.positions.map((pos) => (
                      <PositionTableRow key={pos.betId} pos={pos} onRefresh={loadPortfolio} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
