import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { getAddress, isAddress } from 'viem';
import { Market, MarketStatus, TokenInfo } from '../types/market';
import { AlchemyBaseClient } from '../lib/AlchemyBaseClient';

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';

// Minimal ERC-20 ABI for reading token metadata
const ERC20_ABI = [
  { inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

export function useMarket() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const alchemyClient = useMemo(
    () => new AlchemyBaseClient(ALCHEMY_API_KEY, chainId),
    [chainId]
  );

  // Load markets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('prediction-markets');
    if (stored) {
      try {
        setMarkets(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored markets:', e);
      }
    }
  }, []);

  // Save markets to localStorage whenever they change
  useEffect(() => {
    if (markets.length > 0) {
      localStorage.setItem('prediction-markets', JSON.stringify(markets));
    }
  }, [markets]);

  // Validate and fetch token info using wagmi public client (chain-aware)
  const fetchTokenInfo = useCallback(
    async (tokenAddress: string): Promise<TokenInfo> => {
      setLoading(true);
      setError(null);

      try {
        // Validate address format
        if (!isAddress(tokenAddress)) {
          throw new Error('Invalid Ethereum address format');
        }

        const addr = getAddress(tokenAddress);

        if (!publicClient) {
          throw new Error('Wallet not connected — please connect your wallet first');
        }

        // Check if it's a contract using wagmi's public client (uses connected chain's RPC)
        const code = await publicClient.getBytecode({ address: addr });
        if (!code || code === '0x') {
          throw new Error(
            'Address is not a contract on the current chain. Make sure you are on the correct network and the token address is valid.'
          );
        }

        // Fetch token metadata via multicall (name, symbol, decimals, totalSupply in one batch)
        const [name, symbol, decimals, totalSupplyRaw] = await Promise.all([
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'name' }).catch(() => 'Unknown'),
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'symbol' }).catch(() => '???'),
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'decimals' }).catch(() => 18),
          publicClient.readContract({ address: addr, abi: ERC20_ABI, functionName: 'totalSupply' }).catch(() => BigInt(0)),
        ]);

        // Fetch contract creator (optional, uses Alchemy-specific API)
        let creator = 'Unknown';
        try {
          const creatorInfo = await alchemyClient.getContractCreator(tokenAddress);
          creator = creatorInfo.creator;
        } catch (e) {
          console.warn('Could not fetch creator (Alchemy API may not be available):', e);
        }

        const tokenInfo: TokenInfo = {
          address: tokenAddress,
          name: name as string,
          symbol: symbol as string,
          decimals: Number(decimals),
          creator,
          totalSupply: totalSupplyRaw.toString(),
        };

        setLoading(false);
        return tokenInfo;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch token info';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [publicClient, alchemyClient]
  );

  // Check if bonding curve threshold is reached
  const checkBondingCurveReached = useCallback(
    async (tokenAddress: string, threshold: number): Promise<boolean> => {
      try {
        if (!publicClient) return false;
        const addr = getAddress(tokenAddress);
        const totalSupply = await publicClient.readContract({
          address: addr,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        });
        return Number(totalSupply) >= threshold;
      } catch (err) {
        console.error('Error checking bonding curve:', err);
        return false;
      }
    },
    [publicClient]
  );

  // Create a new market
  const createMarket = useCallback(
    async (
      tokenAddress: string,
      question: string,
      threshold: number,
      deadline: number
    ): Promise<Market> => {
      setLoading(true);
      setError(null);

      try {
        // Validate deadline
        if (deadline <= Date.now()) {
          throw new Error('Deadline must be in the future');
        }

        // Fetch token info
        const tokenInfo = await fetchTokenInfo(tokenAddress);

        // Validate threshold
        const currentSupply = Number(tokenInfo.totalSupply);
        if (threshold <= currentSupply) {
          throw new Error('Threshold must be higher than current total supply');
        }

        // Create market
        const market: Market = {
          id: `${tokenAddress}-${Date.now()}`,
          question,
          tokenAddress,
          tokenName: tokenInfo.name,
          tokenSymbol: tokenInfo.symbol,
          tokenDecimals: tokenInfo.decimals,
          contractCreator: tokenInfo.creator,
          totalSupply: tokenInfo.totalSupply,
          threshold,
          deadline,
          yesPool: 0,
          noPool: 0,
          bets: [],
          resolved: false,
          reached: false,
          createdAt: Date.now(),
        };

        setMarkets((prev) => [...prev, market]);
        setLoading(false);

        return market;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create market';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [fetchTokenInfo]
  );

  // Resolve a market
  const resolveMarket = useCallback(
    async (marketId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const market = markets.find((m) => m.id === marketId);
        if (!market) {
          throw new Error('Market not found');
        }

        if (market.resolved) {
          throw new Error('Market already resolved');
        }

        const now = Date.now();
        if (now < market.deadline) {
          throw new Error('Market deadline has not passed yet');
        }

        // Check if threshold was reached
        const reached = await checkBondingCurveReached(
          market.tokenAddress,
          market.threshold
        );

        setMarkets((prev) =>
          prev.map((m) =>
            m.id === marketId
              ? { ...m, resolved: true, reached, resolvedAt: now }
              : m
          )
        );

        setLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to resolve market';
        setError(message);
        setLoading(false);
        throw new Error(message);
      }
    },
    [markets, checkBondingCurveReached]
  );

  // Get market status
  const getMarketStatus = useCallback((market: Market): MarketStatus => {
    const now = Date.now();

    if (market.resolved) {
      return market.reached ? MarketStatus.REACHED : MarketStatus.FAILED;
    }

    if (now >= market.deadline) {
      return MarketStatus.EXPIRED;
    }

    return MarketStatus.PENDING;
  }, []);

  // Update market total supply
  const updateMarketSupply = useCallback(
    async (marketId: string): Promise<void> => {
      const market = markets.find((m) => m.id === marketId);
      if (!market || !publicClient) return;

      try {
        const addr = getAddress(market.tokenAddress);
        const totalSupply = await publicClient.readContract({
          address: addr,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        });

        setMarkets((prev) =>
          prev.map((m) =>
            m.id === marketId ? { ...m, totalSupply: totalSupply.toString() } : m
          )
        );
      } catch (err) {
        console.error('Failed to update supply:', err);
      }
    },
    [markets, publicClient]
  );

  return {
    markets,
    loading,
    error,
    fetchTokenInfo,
    createMarket,
    resolveMarket,
    getMarketStatus,
    checkBondingCurveReached,
    updateMarketSupply,
  };
}
