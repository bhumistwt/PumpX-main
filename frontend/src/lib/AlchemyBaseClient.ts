import axios from 'axios';

// Configuration
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
const BASE_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Public RPC endpoints per chain (fallback when no Alchemy key)
const PUBLIC_RPC: Record<number, string> = {
  8453:   'https://mainnet.base.org',            // Base Mainnet
  84532:  'https://sepolia.base.org',             // Base Sepolia
  421614: 'https://sepolia-rollup.arbitrum.io/rpc', // Arbitrum Sepolia
  5003:   'https://rpc.sepolia.mantle.xyz',       // Mantle Sepolia
  545:    'https://testnet.evm.nodes.onflow.org', // Flow Testnet
  2810:   'https://rpc-quicknode-holesky.morphl2.io', // Morph Holesky
  88882:  'https://spicy-rpc.chiliz.com',         // Chiliz Spicy
  534351: 'https://sepolia-rpc.scroll.io',        // Scroll Sepolia
};

// Alchemy subdomain per chain
const ALCHEMY_CHAIN: Record<number, string> = {
  8453:   'base-mainnet',
  84532:  'base-sepolia',
  421614: 'arb-sepolia',
};

// Types
interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  timestamp?: number;
  input: string;
}

interface ContractCreator {
  contractAddress: string;
  creator: string;
  txHash: string;
}

class AlchemyBaseClient {
  private rpcUrl: string;

  constructor(apiKey: string, chainId?: number) {
    const cid = chainId || 84532; // default to Base Sepolia
    if (apiKey && ALCHEMY_CHAIN[cid]) {
      this.rpcUrl = `https://${ALCHEMY_CHAIN[cid]}.g.alchemy.com/v2/${apiKey}`;
    } else {
      // Use public RPC when no Alchemy key or unsupported chain
      this.rpcUrl = PUBLIC_RPC[cid] || PUBLIC_RPC[84532];
    }
  }

  // Generic RPC call method
  private async rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
    try {
      const response = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`RPC Error (${method}):`, message);
      throw error;
    }
  }

  // 1. Get ERC20 Token Metadata (Name, Symbol, Decimals)
  async getTokenMetadata(tokenAddress: string): Promise<TokenMetadata> {
    try {
      // ERC20 function signatures
      const NAME_SIG = '0x06fdde03'; // name()
      const SYMBOL_SIG = '0x95d89b41'; // symbol()
      const DECIMALS_SIG = '0x313ce567'; // decimals()

      // Get name
      const nameHex = await this.rpcCall('eth_call', [
        {
          to: tokenAddress,
          data: NAME_SIG,
        },
        'latest',
      ]) as string;

      // Get symbol
      const symbolHex = await this.rpcCall('eth_call', [
        {
          to: tokenAddress,
          data: SYMBOL_SIG,
        },
        'latest',
      ]) as string;

      // Get decimals
      const decimalsHex = await this.rpcCall('eth_call', [
        {
          to: tokenAddress,
          data: DECIMALS_SIG,
        },
        'latest',
      ]) as string;

      return {
        name: this.decodeString(nameHex),
        symbol: this.decodeString(symbolHex),
        decimals: parseInt(decimalsHex, 16),
      };
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      throw error;
    }
  }

  // Get total supply
  async getTotalSupply(tokenAddress: string): Promise<string> {
    try {
      const TOTAL_SUPPLY_SIG = '0x18160ddd'; // totalSupply()

      const totalSupplyHex = await this.rpcCall('eth_call', [
        {
          to: tokenAddress,
          data: TOTAL_SUPPLY_SIG,
        },
        'latest',
      ]) as string;

      return BigInt(totalSupplyHex).toString();
    } catch (error) {
      console.error('Error fetching total supply:', error);
      throw error;
    }
  }

  // 2. Get Token Metadata using Alchemy's Enhanced API
  async getTokenMetadataEnhanced(tokenAddress: string): Promise<unknown> {
    try {
      const response = await this.rpcCall('alchemy_getTokenMetadata', [
        tokenAddress,
      ]);
      return response;
    } catch (error) {
      console.error('Error fetching enhanced token metadata:', error);
      throw error;
    }
  }

  // 3. Get Transactions for an Address - Base compatible
  async getTransactionsByAddress(
    address: string,
    fromBlock: string = '0x0',
    toBlock: string = 'latest'
  ): Promise<Transaction[]> {
    try {
      // Base doesn't support 'internal' category
      const response = await this.rpcCall('alchemy_getAssetTransfers', [
        {
          fromBlock,
          toBlock,
          fromAddress: address,
          category: ['external', 'erc20', 'erc721', 'erc1155'], // Removed 'internal'
          withMetadata: true,
          excludeZeroValue: false,
          maxCount: '0x3e8', // 1000 transactions
        },
      ]) as { transfers: Transaction[] };

      return response.transfers || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // 4. Get Transaction Receipt
  async getTransactionReceipt(txHash: string): Promise<unknown> {
    try {
      return await this.rpcCall('eth_getTransactionReceipt', [txHash]);
    } catch (error) {
      console.error('Error fetching transaction receipt:', error);
      throw error;
    }
  }

  // 5. Get Contract Creator (Deployer Address) - Base chain compatible
  async getContractCreator(contractAddress: string): Promise<ContractCreator> {
    try {
      // Get contract code to verify it's a contract
      const code = await this.rpcCall('eth_getCode', [contractAddress, 'latest']) as string;

      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      // Base doesn't support 'internal' category - use only 'external'
      const result = await this.rpcCall('alchemy_getAssetTransfers', [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          toAddress: contractAddress,
          category: ['external'], // Only external for Base
          maxCount: '0x1',
          withMetadata: true,
        },
      ]) as { transfers: Array<{ from: string; hash: string }> };

      if (result.transfers && result.transfers.length > 0) {
        const firstTransfer = result.transfers[0];
        return {
          contractAddress,
          creator: firstTransfer.from,
          txHash: firstTransfer.hash,
        };
      }

      throw new Error('Could not find contract creator');
    } catch (error) {
      console.error('Error finding contract creator:', error);
      throw error;
    }
  }

  // 6. Alternative method to get contract creator using block scanning - Base compatible
  async findContractDeployment(contractAddress: string): Promise<ContractCreator> {
    try {
      const result = await axios.post(this.rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            contractAddresses: [contractAddress],
            category: ['external', 'erc20'], // Removed 'internal' for Base
            withMetadata: true,
            maxCount: '0x1',
            order: 'asc',
          },
        ],
      });

      const transfers = result.data?.result?.transfers;

      if (transfers && transfers.length > 0) {
        const txReceipt = await this.getTransactionReceipt(transfers[0].hash) as { from: string };

        return {
          contractAddress,
          creator: txReceipt.from,
          txHash: transfers[0].hash,
        };
      }

      throw new Error('Could not find deployment transaction');
    } catch (error) {
      console.error('Error finding contract deployment:', error);
      throw error;
    }
  }

  // 7. Get ERC20 Token Transfers
  async getERC20Transfers(
    tokenAddress: string,
    fromBlock: string = '0x0',
    toBlock: string = 'latest'
  ): Promise<unknown[]> {
    try {
      const response = await this.rpcCall('alchemy_getAssetTransfers', [
        {
          fromBlock,
          toBlock,
          contractAddresses: [tokenAddress],
          category: ['erc20'],
          withMetadata: true,
          maxCount: '0x3e8',
        },
      ]) as { transfers: unknown[] };

      return response.transfers || [];
    } catch (error) {
      console.error('Error fetching ERC20 transfers:', error);
      throw error;
    }
  }

  // Helper function to decode hex string to UTF-8
  private decodeString(hex: string): string {
    if (!hex || hex === '0x') return '';

    hex = hex.startsWith('0x') ? hex.slice(2) : hex;

    const length = parseInt(hex.slice(64, 128), 16) * 2;
    const data = hex.slice(128, 128 + length);

    let str = '';
    for (let i = 0; i < data.length; i += 2) {
      const charCode = parseInt(data.substr(i, 2), 16);
      if (charCode !== 0) str += String.fromCharCode(charCode);
    }

    return str;
  }

  // 8. Get block details with timestamp
  async getBlock(blockNumber: string): Promise<unknown> {
    try {
      return await this.rpcCall('eth_getBlockByNumber', [blockNumber, true]);
    } catch (error) {
      console.error('Error fetching block:', error);
      throw error;
    }
  }

  // Check if address is a valid contract
  async isContract(address: string): Promise<boolean> {
    try {
      const code = await this.rpcCall('eth_getCode', [address, 'latest']) as string;
      return code !== '0x' && code !== '0x0';
    } catch (error) {
      return false;
    }
  }
}

export { AlchemyBaseClient };
export type { TokenMetadata, Transaction, ContractCreator };
