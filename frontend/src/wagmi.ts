import {
  Chain,
  base,
  arbitrumSepolia,
  baseSepolia,
  chiliz,
  neonDevnet,
  mantleSepoliaTestnet,
  flowTestnet,
  scrollSepolia,
  morphHolesky,
} from "wagmi/chains";
import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import {
  connectorsForWallets,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";

export const chilizSpicyTestnet = {
  id: 88_882,
  name: "Chiliz Spicy Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "CHZ",
    symbol: "CHZ",
  },
  rpcUrls: {
    default: {
      http: ["https://spicy-rpc.chiliz.com/"],
    },
    public: {
      http: ["https://spicy-rpc.chiliz.com/"],
    },
  },
  blockExplorers: {
    default: {
      name: "ChilizScan Testnet",
      url: "https://spicy-explorer.chiliz.com",
    },
  },
  testnet: true,
} as const satisfies Chain;

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "placeholder_temp_id";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        injectedWallet,
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: "PumpX",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [baseSepolia, base],   // Base Sepolia first — factory contract is deployed there
  transports: {
    [baseSepolia.id]: http("https://base-sepolia-rpc.publicnode.com"),  // reliable free RPC
    [base.id]: http("https://base-rpc.publicnode.com"),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});
