/**
 * Cross-Chain Token Supply Tracker
 *
 * GET /api/supply/[token]
 *
 * Reads totalSupply from the given ERC-20 token address across all configured
 * chains (Base Sepolia, Arbitrum Sepolia, Mantle Sepolia, Flow Testnet,
 * Morph Holesky, Chiliz Testnet, Scroll Sepolia) simultaneously.
 *
 * Returns per-chain supply, aggregate, and distribution percentages.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, http, formatUnits, type Chain } from 'viem';
import {
  baseSepolia,
  arbitrumSepolia,
  mantleSepoliaTestnet,
  scrollSepolia,
} from 'viem/chains';

// ---------- chain definitions (including custom testnets) ----------

const flowTestnet: Chain = {
  id: 545,
  name: 'Flow Testnet',
  nativeCurrency: { name: 'FLOW', symbol: 'FLOW', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.evm.nodes.onflow.org'] } },
  blockExplorers: {
    default: { name: 'FlowDiver', url: 'https://testnet.flowdiver.io' },
  },
};

const morphHolesky: Chain = {
  id: 2810,
  name: 'Morph Holesky',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-quicknode-holesky.morphl2.io'] },
  },
  blockExplorers: {
    default: {
      name: 'MorphExplorer',
      url: 'https://explorer-api-holesky.morphl2.io',
    },
  },
};

const chilizTestnet: Chain = {
  id: 88882,
  name: 'Chiliz Spicy Testnet',
  nativeCurrency: { name: 'CHZ', symbol: 'CHZ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://spicy-rpc.chiliz.com'] },
  },
  blockExplorers: {
    default: {
      name: 'ChiliScan',
      url: 'https://testnet.chiliscan.com',
    },
  },
};

// ---------- chain registry ----------

interface ChainInfo {
  id: number;
  name: string;
  chain: Chain;
  color: string; // for frontend charts
  icon: string;
}

const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: 84532,
    name: 'Base Sepolia',
    chain: baseSepolia,
    color: '#0052FF',
    icon: '🔵',
  },
  {
    id: 421614,
    name: 'Arbitrum Sepolia',
    chain: arbitrumSepolia,
    color: '#28A0F0',
    icon: '🔷',
  },
  {
    id: 5003,
    name: 'Mantle Sepolia',
    chain: mantleSepoliaTestnet,
    color: '#000000',
    icon: '⬛',
  },
  {
    id: 545,
    name: 'Flow Testnet',
    chain: flowTestnet,
    color: '#00EF8B',
    icon: '🟢',
  },
  {
    id: 2810,
    name: 'Morph Holesky',
    chain: morphHolesky,
    color: '#8B5CF6',
    icon: '🟣',
  },
  {
    id: 88882,
    name: 'Chiliz Spicy',
    chain: chilizTestnet,
    color: '#FF003F',
    icon: '🔴',
  },
  {
    id: 534351,
    name: 'Scroll Sepolia',
    chain: scrollSepolia,
    color: '#FFEEDA',
    icon: '📜',
  },
];

// ERC-20 ABI subset
const ERC20_ABI = [
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface ChainSupply {
  chainId: number;
  chainName: string;
  color: string;
  icon: string;
  supply: string;
  supplyFormatted: string;
  decimals: number;
  available: boolean;
  error?: string;
}

async function fetchChainSupply(
  chain: ChainInfo,
  tokenAddress: `0x${string}`
): Promise<ChainSupply> {
  try {
    const client = createPublicClient({
      chain: chain.chain,
      transport: http(),
    });

    const [totalSupply, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      }),
      client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    return {
      chainId: chain.id,
      chainName: chain.name,
      color: chain.color,
      icon: chain.icon,
      supply: totalSupply.toString(),
      supplyFormatted: formatUnits(totalSupply, decimals),
      decimals,
      available: true,
    };
  } catch (err: any) {
    return {
      chainId: chain.id,
      chainName: chain.name,
      color: chain.color,
      icon: chain.icon,
      supply: '0',
      supplyFormatted: '0',
      decimals: 18,
      available: false,
      error: 'Token not deployed on this chain',
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  const tokenAddress = (
    Array.isArray(token) ? token[0] : token
  ) as `0x${string}`;

  if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    return res.status(400).json({ error: 'Invalid token address' });
  }

  try {
    // Fetch from all chains in parallel
    const results = await Promise.all(
      SUPPORTED_CHAINS.map((c) => fetchChainSupply(c, tokenAddress))
    );

    // Also try to get token metadata from Base Sepolia (primary chain)
    let tokenName = '';
    let tokenSymbol = '';
    try {
      const baseClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });
      const [name, symbol] = await Promise.all([
        baseClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        baseClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
      ]);
      tokenName = name;
      tokenSymbol = symbol;
    } catch {
      // Token metadata unavailable
    }

    // Compute aggregate
    const availableChains = results.filter((r) => r.available);
    const totalSupplyBigInt = availableChains.reduce(
      (sum, r) => sum + BigInt(r.supply),
      0n
    );
    const primaryDecimals = availableChains[0]?.decimals ?? 18;

    // Distribution percentages
    const chainsWithDistribution = results.map((r) => ({
      ...r,
      percentage:
        totalSupplyBigInt > 0n && r.available
          ? Number((BigInt(r.supply) * 10000n) / totalSupplyBigInt) / 100
          : 0,
    }));

    return res.status(200).json({
      tokenAddress,
      tokenName,
      tokenSymbol,
      chains: chainsWithDistribution,
      aggregate: {
        totalSupply: totalSupplyBigInt.toString(),
        totalSupplyFormatted: formatUnits(totalSupplyBigInt, primaryDecimals),
        chainsDeployed: availableChains.length,
        chainsChecked: results.length,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Cross-chain supply error:', error);
    return res.status(500).json({ error: 'Failed to fetch cross-chain supply' });
  }
}
