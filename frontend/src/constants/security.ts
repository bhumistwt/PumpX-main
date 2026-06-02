import { FACTORY_ADDRESS_SEPOLIA } from './contracts';

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '84532', 10);

const EXPLORER_BY_CHAIN: Record<number, string> = {
  8453: 'https://basescan.org',
  84532: 'https://sepolia.basescan.org',
};

/** MarketFactory deployment date (ISO date, display-only). */
export const FACTORY_DEPLOYED_AT =
  process.env.NEXT_PUBLIC_FACTORY_DEPLOYED_AT || '2026-05-28';

export function getFactoryAddress(): `0x${string}` {
  const fromEnv = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  if (fromEnv && fromEnv.startsWith('0x')) return fromEnv as `0x${string}`;
  return FACTORY_ADDRESS_SEPOLIA;
}

export function getFactoryExplorerUrl(chainId = CHAIN_ID): string {
  const base = EXPLORER_BY_CHAIN[chainId] ?? EXPLORER_BY_CHAIN[84532];
  return `${base}/address/${getFactoryAddress()}`;
}

export const SECURITY_META = {
  contractName: 'MarketFactory',
  networkLabel: CHAIN_ID === 8453 ? 'Base' : 'Base Sepolia',
  chainId: CHAIN_ID,
  deployedAt: FACTORY_DEPLOYED_AT,
  foundryTestsLabel: 'Foundry test suite passing',
  foundryTestsUrl:
    process.env.NEXT_PUBLIC_FOUNDRY_TESTS_URL ||
    'https://github.com/bhumistwt/PumpX-main/tree/main/contract',
} as const;
