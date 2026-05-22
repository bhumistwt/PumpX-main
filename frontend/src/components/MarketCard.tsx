import React, { useState, useEffect, useMemo } from 'react';
import { Market, MarketStatus } from '../types/market';
import { useMarket } from '../hooks/useMarket';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { MILESTONE_MARKET_ABI } from '../constants/contracts';
import { parseEther, formatEther } from 'viem';
import { useGamification } from '../hooks/useGamification';

interface MarketCardProps {
  market: Market;
  onUpdate?: () => void;
}

export default function MarketCard({ market, onUpdate }: MarketCardProps) {
  const { address } = useAccount();
  const { getMarketStatus, updateMarketSupply } = useMarket();
  const { onBetPlaced, isAuthenticated } = useGamification();

  const [timeRemaining, setTimeRemaining] = useState('');
  const [progress, setProgress] = useState(0);
  const [betAmount, setBetAmount] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (writeError) {
      setTxStatus('error');
      setTimeout(() => setTxStatus('idle'), 4000);
    }
  }, [writeError]);

  useEffect(() => {
    if (isPending) setTxStatus('pending');
  }, [isPending]);

  useEffect(() => {
    if (isSuccess) {
      setTxStatus('success');

      // Trigger gamification XP for successful bet
      if (isAuthenticated) {
        onBetPlaced();
      }

      onUpdate?.();
      setBetAmount('');
      setTimeout(() => setTxStatus('idle'), 3000);
    }
  }, [isSuccess, onUpdate]);

  const { data: ethBalance } = useBalance({ address });

  // On-chain reads
  const contractAddr = market.marketContract as `0x${string}`;
  const enabled = !!market.marketContract;

  const { data: onChainResolved } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'resolved',
    query: { enabled }
  });
  const { data: onChainReached } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'reached',
    query: { enabled: enabled && !!onChainResolved }
  });
  const { data: totalYes } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'totalYes',
    query: { enabled }
  });
  const { data: totalNo } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'totalNo',
    query: { enabled }
  });
  const { data: userYesDeposit } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'yesDeposits',
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address }
  });
  const { data: userNoDeposit } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'noDeposits',
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address }
  });
  const { data: hasClaimed } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'claimed',
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address && !!onChainResolved }
  });
  const { data: onChainDeadline } = useReadContract({
    address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'deadline',
    query: { enabled }
  });

  const status = getMarketStatus(market);

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = market.deadline - now;
      if (remaining <= 0) { setTimeRemaining('Expired'); return; }
      const d = Math.floor(remaining / 86400000);
      const h = Math.floor((remaining % 86400000) / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${d}d ${h}h ${m}m ${s}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [market.deadline]);

  // Progress
  useEffect(() => {
    const currentSupply = Number(market.totalSupply);
    setProgress(Math.min((currentSupply / market.threshold) * 100, 100));
  }, [market.totalSupply, market.threshold]);

  // Auto-refresh supply
  useEffect(() => {
    if (status === MarketStatus.PENDING) {
      const interval = setInterval(() => updateMarketSupply(market.id), 10000);
      return () => clearInterval(interval);
    }
  }, [market.id, status, updateMarketSupply]);

  // Computed values
  const yesEth = totalYes ? Number(formatEther(totalYes as bigint)) : 0;
  const noEth = totalNo ? Number(formatEther(totalNo as bigint)) : 0;
  const totalPool = yesEth + noEth;
  const yesPct = totalPool > 0 ? (yesEth / totalPool) * 100 : 50;
  const currentSupply = Number(market.totalSupply) / Math.pow(10, market.tokenDecimals);
  const thresholdDisplay = market.threshold / Math.pow(10, market.tokenDecimals);
  const isResolved = onChainResolved || market.resolved;
  const hasReached = onChainReached || market.reached;

  const validateBet = (): string | null => {
    if (!market.marketContract) return 'No market contract';
    if (!betAmount || Number(betAmount) <= 0) return 'Enter a valid amount';
    if (!address) return 'Connect wallet first';
    if (onChainResolved) return 'Market already resolved';
    if (onChainDeadline) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= Number(onChainDeadline)) return 'Market deadline passed';
    }
    return null;
  };

  const handleBet = (side: 'yes' | 'no') => {
    const err = validateBet();
    if (err) return;
    try {
      writeContract({
        address: contractAddr,
        abi: MILESTONE_MARKET_ABI,
        functionName: side === 'yes' ? 'depositYes' : 'depositNo',
        value: parseEther(betAmount),
      });
    } catch {}
  };

  const handleResolve = () => {
    if (!market.marketContract) return;
    writeContract({ address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'resolve' });
  };

  const handleClaim = () => {
    if (!market.marketContract) return;
    writeContract({ address: contractAddr, abi: MILESTONE_MARKET_ABI, functionName: 'claim' });
  };

  const statusBadge = useMemo(() => {
    if (isResolved) return { label: hasReached ? 'YES Won' : 'NO Won', color: hasReached ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20' };
    if (status === MarketStatus.EXPIRED) return { label: 'Awaiting Resolution', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
    return { label: 'Active', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  }, [isResolved, hasReached, status]);

  return (
    <div className="card group hover:border-[var(--accent-primary)]/30 transition-all duration-300">
      {/* Transaction feedback overlay */}
      {txStatus === 'pending' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--accent-primary)]">Confirming transaction...</span>
          </div>
        </div>
      )}
      {txStatus === 'success' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 text-xl">✓</div>
            <span className="text-sm text-emerald-400">Transaction confirmed</span>
          </div>
        </div>
      )}
      {txStatus === 'error' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2 max-w-[80%]">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center text-red-400 text-xl">✗</div>
            <span className="text-sm text-red-400 text-center">{writeError?.message?.slice(0, 80) || 'Transaction failed'}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-3">
          <h3 className="text-base font-semibold text-white leading-snug line-clamp-2 mb-1">
            {market.question}
          </h3>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-mono">{market.tokenSymbol}</span>
            {market.marketContract && (
              <>
                <span className="opacity-40">·</span>
                <span className="font-mono">{market.marketContract.slice(0, 6)}…{market.marketContract.slice(-4)}</span>
              </>
            )}
          </div>
        </div>
        <span className={`badge shrink-0 text-[10px] border ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Supply Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-[var(--text-muted)]">Supply Progress</span>
          <span className="text-white font-mono font-medium">{progress.toFixed(1)}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1 font-mono">
          <span>{currentSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>{thresholdDisplay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Sentiment Bar (YES vs NO visual) */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-emerald-400 font-medium">YES {yesPct.toFixed(0)}%</span>
          <span className="text-red-400 font-medium">NO {(100 - yesPct).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${yesPct}%` }} />
          <div className="bg-red-500 transition-all duration-500" style={{ width: `${100 - yesPct}%` }} />
        </div>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mb-0.5">YES Pool</p>
          <p className="font-mono font-semibold text-white text-sm">{yesEth.toFixed(4)} <span className="text-[var(--text-muted)] text-xs">ETH</span></p>
          {userYesDeposit && Number(userYesDeposit) > 0 && (
            <p className="text-[10px] text-emerald-400 mt-1 font-mono">You: {Number(formatEther(userYesDeposit as bigint)).toFixed(4)} ETH</p>
          )}
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2.5">
          <p className="text-[10px] text-red-400/70 uppercase tracking-wider mb-0.5">NO Pool</p>
          <p className="font-mono font-semibold text-white text-sm">{noEth.toFixed(4)} <span className="text-[var(--text-muted)] text-xs">ETH</span></p>
          {userNoDeposit && Number(userNoDeposit) > 0 && (
            <p className="text-[10px] text-red-400 mt-1 font-mono">You: {Number(formatEther(userNoDeposit as bigint)).toFixed(4)} ETH</p>
          )}
        </div>
      </div>

      {/* Betting Interface */}
      {status === MarketStatus.PENDING && address && market.marketContract && (
        <div className="mb-4 space-y-2.5">
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="0.00"
              className="input w-full pr-14 font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">ETH</span>
          </div>

          {ethBalance && (
            <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)]">
              <span>Balance: {Number(formatEther(ethBalance.value)).toFixed(4)} ETH</span>
              <button
                onClick={() => setBetAmount(Number(formatEther(ethBalance.value)).toFixed(4))}
                className="text-[var(--accent-primary)] hover:underline"
              >
                MAX
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleBet('yes')}
              disabled={!betAmount || isPending}
              className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 disabled:!bg-[var(--bg-elevated)] disabled:opacity-50 text-sm py-2.5"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Betting…
                </span>
              ) : 'Bet YES ↑'}
            </button>
            <button
              onClick={() => handleBet('no')}
              disabled={!betAmount || isPending}
              className="btn-primary !bg-red-600 hover:!bg-red-500 disabled:!bg-[var(--bg-elevated)] disabled:opacity-50 text-sm py-2.5"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Betting…
                </span>
              ) : 'Bet NO ↓'}
            </button>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px]">
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${status === MarketStatus.PENDING ? 'bg-emerald-400 animate-pulse' : 'bg-[var(--text-muted)]'}`} />
          <span className="text-[var(--text-muted)] font-mono">{timeRemaining}</span>
        </div>
        <span className="text-[var(--text-muted)] font-mono">{totalPool.toFixed(4)} ETH</span>
        <span className="text-[var(--text-muted)]">{new Date(market.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Action Buttons */}
      {status === MarketStatus.EXPIRED && !isResolved && market.marketContract && (
        <button onClick={handleResolve} disabled={isPending}
          className="btn-primary w-full mt-3 !bg-amber-600 hover:!bg-amber-500 text-sm">
          {isPending ? 'Resolving…' : 'Resolve Market'}
        </button>
      )}

      {isResolved && (
        <div className={`mt-3 text-center p-3 rounded-lg ${
          hasReached ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
        }`}>
          <p className={`font-semibold text-lg ${hasReached ? 'text-emerald-400' : 'text-red-400'}`}>
            {hasReached ? '↑ YES Wins' : '↓ NO Wins'}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            Final: {currentSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {thresholdDisplay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
      )}

      {isResolved && address && !hasClaimed && market.marketContract && (
        ((hasReached && userYesDeposit && Number(userYesDeposit) > 0) ||
          (!hasReached && userNoDeposit && Number(userNoDeposit) > 0)) && (
          <button onClick={handleClaim} disabled={isPending}
            className="btn-primary w-full mt-2 text-sm">
            {isPending ? 'Claiming…' : 'Claim Winnings →'}
          </button>
        )
      )}

      {hasClaimed && (
        <div className="mt-3 text-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-emerald-400 text-xs font-medium">✓ Winnings Claimed</p>
        </div>
      )}
    </div>
  );
}
