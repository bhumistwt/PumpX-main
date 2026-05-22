/**
 * PumpX — Chain Configuration
 *
 * Dynamic, environment-driven chain configuration.
 * Zero hardcoded network assumptions.
 */

export interface ChainConfig {
  id: number;
  name: string;
  explorerUrl: string;
  explorerTxPath: string;
  explorerAddressPath: string;
  rpcUrl: string;
  wsUrl?: string;
  factoryAddress: string;
  isTestnet: boolean;
}

const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Base Mainnet
  8453: {
    id: 8453,
    name: 'Base',
    explorerUrl: 'https://basescan.org',
    explorerTxPath: '/tx/',
    explorerAddressPath: '/address/',
    rpcUrl: process.env.BASE_MAINNET_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
    wsUrl: process.env.BASE_MAINNET_WS_URL || `wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
    factoryAddress: process.env.BASE_MAINNET_FACTORY_ADDRESS || '',
    isTestnet: false,
  },
  // Base Sepolia
  84532: {
    id: 84532,
    name: 'Base Sepolia',
    explorerUrl: 'https://sepolia.basescan.org',
    explorerTxPath: '/tx/',
    explorerAddressPath: '/address/',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
    wsUrl: process.env.BASE_SEPOLIA_WS_URL || `wss://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
    factoryAddress: process.env.BASE_SEPOLIA_FACTORY_ADDRESS || '0x3b4774D45De4e271f857cAa7830Ee283bD7Bf544',
    isTestnet: true,
  },
};

/** Get chain config for a given chain ID */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/** Get the active chain config based on environment */
export function getActiveChainConfig(): ChainConfig {
  const envChainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532', 10);
  const config = CHAIN_CONFIGS[envChainId];
  if (!config) {
    throw new Error(`No chain configuration for chainId=${envChainId}. Add it to CHAIN_CONFIGS.`);
  }
  return config;
}

/** Get all supported chain configs */
export function getSupportedChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS).filter(c =>
    process.env.NODE_ENV === 'production' ? !c.isTestnet : true
  );
}

/** Build explorer URL for a transaction */
export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) return `https://blockscan.com/tx/${txHash}`;
  return `${config.explorerUrl}${config.explorerTxPath}${txHash}`;
}

/** Build explorer URL for an address */
export function getExplorerAddressUrl(chainId: number, address: string): string {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) return `https://blockscan.com/address/${address}`;
  return `${config.explorerUrl}${config.explorerAddressPath}${address}`;
}

/** Get factory address for a chain */
export function getFactoryAddress(chainId: number): string {
  const config = CHAIN_CONFIGS[chainId];
  if (!config || !config.factoryAddress) {
    throw new Error(`No factory address configured for chainId=${chainId}`);
  }
  return config.factoryAddress;
}
