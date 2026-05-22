/**
 * CrossChainSupply — visualises token supply across 7 chains
 *
 * Props:
 *   tokenAddress? — pre-fill token address
 *
 * Two exports:
 *   CrossChainSupply — full dashboard
 *   SupplyBadge      — compact inline badge for market cards
 */

import React, { useState, useCallback, useEffect } from 'react';

interface ChainData {
  chainId: number;
  chainName: string;
  color: string;
  icon: string;
  supply: string;
  supplyFormatted: string;
  decimals: number;
  available: boolean;
  percentage: number;
  error?: string;
}

interface SupplyData {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  chains: ChainData[];
  aggregate: {
    totalSupply: string;
    totalSupplyFormatted: string;
    chainsDeployed: number;
    chainsChecked: number;
  };
  timestamp: number;
}

function formatNumber(n: string): string {
  const num = parseFloat(n);
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/* ─── Full Dashboard ─── */

export function CrossChainSupply({
  tokenAddress: initialAddress,
}: {
  tokenAddress?: string;
}) {
  const [address, setAddress] = useState(initialAddress || '');
  const [data, setData] = useState<SupplyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchSupply = useCallback(
    async (addr?: string) => {
      const target = addr || address;
      if (!target || !/^0x[a-fA-F0-9]{40}$/.test(target)) {
        setError('Enter a valid token address');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/supply/${target}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch {
        setError('Failed to fetch cross-chain supply');
      } finally {
        setLoading(false);
      }
    },
    [address]
  );

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !data) return;
    const t = setInterval(() => fetchSupply(data.tokenAddress), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, data, fetchSupply]);

  // Auto-fetch if address provided
  useEffect(() => {
    if (initialAddress) fetchSupply(initialAddress);
  }, [initialAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxSupply = data
    ? Math.max(
        ...data.chains
          .filter((c) => c.available)
          .map((c) => parseFloat(c.supplyFormatted))
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex gap-3">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... token address"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => fetchSupply()}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 rounded-lg text-white font-semibold transition-colors"
        >
          {loading ? (
            <span className="inline-block animate-spin">⟳</span>
          ) : (
            '🔍 Track'
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Token Header */}
          <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {data.tokenSymbol || 'Unknown Token'}
                  {data.tokenName && (
                    <span className="text-zinc-400 font-normal text-sm ml-2">
                      ({data.tokenName})
                    </span>
                  )}
                </h3>
                <p className="text-zinc-500 font-mono text-xs mt-1">
                  {data.tokenAddress}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    autoRefresh
                      ? 'border-green-500 text-green-400 bg-green-900/20'
                      : 'border-zinc-600 text-zinc-400'
                  }`}
                >
                  {autoRefresh ? '● Live' : '○ Auto-refresh'}
                </button>
                <button
                  onClick={() => fetchSupply(data.tokenAddress)}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Refresh"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-zinc-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {formatNumber(data.aggregate.totalSupplyFormatted)}
                </div>
                <div className="text-xs text-zinc-500 mt-1">Total Supply</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {data.aggregate.chainsDeployed}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Chains Active
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {data.aggregate.chainsChecked}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Chains Checked
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Bar */}
          <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-zinc-300 mb-3">
              Supply Distribution
            </h4>
            <div className="flex h-8 rounded-lg overflow-hidden mb-3">
              {data.chains
                .filter((c) => c.available && c.percentage > 0)
                .map((chain) => (
                  <div
                    key={chain.chainId}
                    className="relative group transition-all duration-300"
                    style={{
                      width: `${Math.max(chain.percentage, 2)}%`,
                      backgroundColor: chain.color,
                    }}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-xs whitespace-nowrap">
                        <div className="font-semibold text-white">
                          {chain.icon} {chain.chainName}
                        </div>
                        <div className="text-zinc-400">
                          {chain.percentage.toFixed(1)}% (
                          {formatNumber(chain.supplyFormatted)})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {data.chains
                .filter((c) => c.available)
                .map((chain) => (
                  <div key={chain.chainId} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: chain.color }}
                    />
                    <span className="text-zinc-400">
                      {chain.icon} {chain.chainName} ({chain.percentage.toFixed(1)}%)
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Per-Chain Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.chains.map((chain) => (
              <div
                key={chain.chainId}
                className={`border rounded-xl p-4 transition-all ${
                  chain.available
                    ? 'bg-zinc-900/80 border-zinc-700 hover:border-zinc-500'
                    : 'bg-zinc-900/30 border-zinc-800 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{chain.icon}</span>
                    <span className="font-semibold text-white text-sm">
                      {chain.chainName}
                    </span>
                  </div>
                  {chain.available ? (
                    <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                      Not deployed
                    </span>
                  )}
                </div>

                {chain.available ? (
                  <>
                    <div className="text-xl font-bold text-white mb-2">
                      {formatNumber(chain.supplyFormatted)}
                    </div>
                    {/* Bar */}
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${maxSupply > 0 ? (parseFloat(chain.supplyFormatted) / maxSupply) * 100 : 0}%`,
                          backgroundColor: chain.color,
                        }}
                      />
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      {chain.percentage.toFixed(1)}% of total supply
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-zinc-600">
                    {chain.error || 'Not available'}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Timestamp */}
          <div className="text-center text-xs text-zinc-600">
            Last updated:{' '}
            {new Date(data.timestamp).toLocaleString()}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Compact Badge ─── */

export function SupplyBadge({
  tokenAddress,
}: {
  tokenAddress: string;
}) {
  const [chains, setChains] = useState(0);
  const [total, setTotal] = useState('');

  useEffect(() => {
    if (!tokenAddress) return;
    fetch(`/api/supply/${tokenAddress}`)
      .then((r) => r.json())
      .then((d) => {
        setChains(d.aggregate?.chainsDeployed || 0);
        setTotal(d.aggregate?.totalSupplyFormatted || '0');
      })
      .catch(() => {});
  }, [tokenAddress]);

  if (!chains) return null;

  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full">
      🌐 {chains} chain{chains !== 1 ? 's' : ''} · {formatNumber(total)}
    </span>
  );
}
