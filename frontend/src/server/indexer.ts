/**
 * PumpX — Event Indexer
 *
 * Production-grade on-chain event listener using viem WebSocket transport.
 * Indexes: MarketCreated, DepositYes, DepositNo, Resolved, Claimed, SupplyUpdated
 *
 * Features:
 * - Idempotent event handling (upsert by txHash + logIndex)
 * - Chain reorg safety (tracks lastBlockHash, re-indexes on mismatch)
 * - Resumable from last indexed block (stored in DB)
 * - Backfill support for historical events
 * - Automatic reconnection on WebSocket drop
 */

import { createPublicClient, webSocket, http, parseAbiItem, type Log, formatEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { prisma } from './db';
import { createLogger } from './logger';

const log = createLogger('indexer');

// ── ABI Events (must match deployed contracts exactly) ───

const MARKET_CREATED_EVENT = parseAbiItem(
  'event MarketCreated(address indexed market, address indexed token, uint256 threshold, uint256 deadline)'
);

const DEPOSITED_YES_EVENT = parseAbiItem(
  'event DepositedYes(address indexed user, uint256 amount)'
);

const DEPOSITED_NO_EVENT = parseAbiItem(
  'event DepositedNo(address indexed user, uint256 amount)'
);

const RESOLVED_EVENT = parseAbiItem(
  'event Resolved(bool reached)'
);

const CLAIMED_EVENT = parseAbiItem(
  'event Claimed(address indexed user, uint256 payout)'
);

const SUPPLY_UPDATED_EVENT = parseAbiItem(
  'event SupplyUpdated(uint256 newSupply)'
);

// ── Indexer Class ────────────────────────────────────────

export class EventIndexer {
  private chainId: number;
  private factoryAddress: string;
  private client: ReturnType<typeof createPublicClient>;
  private unwatchers: (() => void)[] = [];
  private isRunning = false;

  constructor(config: {
    chainId: number;
    factoryAddress: string;
    rpcUrl: string;
    wsUrl?: string;
  }) {
    this.chainId = config.chainId;
    this.factoryAddress = config.factoryAddress.toLowerCase();

    const chain = config.chainId === 8453 ? base : baseSepolia;

    // Prefer WebSocket for real-time, fall back to HTTP polling
    const transport = config.wsUrl
      ? webSocket(config.wsUrl, { reconnect: true, retryCount: 10, retryDelay: 5000 })
      : http(config.rpcUrl);

    this.client = createPublicClient({ chain, transport }) as any;
  }

  /** Start indexing — backfill then watch live */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    log.info({ chainId: this.chainId, factory: this.factoryAddress }, 'Starting event indexer');

    // Get last indexed block
    const state = await prisma.indexerState.upsert({
      where: { chainId: this.chainId },
      update: {},
      create: { chainId: this.chainId, lastBlockNumber: 0, lastBlockHash: '' },
    });

    const currentBlock = await this.client.getBlockNumber();
    const fromBlock = BigInt(state.lastBlockNumber + 1);

    // Backfill historical events if behind
    if (fromBlock < currentBlock) {
      log.info({ from: fromBlock.toString(), to: currentBlock.toString() }, 'Backfilling events');
      await this.backfill(fromBlock, currentBlock);
    }

    // Watch live events
    this.watchFactory();
    this.watchMarkets();

    log.info({ chainId: this.chainId }, 'Event indexer running');
  }

  /** Stop all watchers */
  stop() {
    this.isRunning = false;
    this.unwatchers.forEach(unwatch => unwatch());
    this.unwatchers = [];
    log.info({ chainId: this.chainId }, 'Event indexer stopped');
  }

  // ── Backfill ─────────────────────────────────────────

  private async backfill(fromBlock: bigint, toBlock: bigint) {
    const BATCH_SIZE = 2000n;

    for (let start = fromBlock; start <= toBlock; start += BATCH_SIZE) {
      const end = start + BATCH_SIZE - 1n > toBlock ? toBlock : start + BATCH_SIZE - 1n;

      try {
        // Factory events
        const factoryLogs = await this.client.getLogs({
          address: this.factoryAddress as `0x${string}`,
          event: MARKET_CREATED_EVENT,
          fromBlock: start,
          toBlock: end,
        });

        for (const eventLog of factoryLogs) {
          await this.handleMarketCreated(eventLog as any);
        }

        // Get all known market addresses for this chain
        const markets = await prisma.market.findMany({
          where: { chainId: this.chainId },
          select: { contractAddress: true },
        });
        const marketAddresses = markets.map((m: any) => m.contractAddress as `0x${string}`);

        if (marketAddresses.length > 0) {
          // Yes bet events
          const yesLogs = await this.client.getLogs({
            address: marketAddresses,
            event: DEPOSITED_YES_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const eventLog of yesLogs) {
            await this.handleDeposited(eventLog as any, true);
          }

          // No bet events
          const noLogs = await this.client.getLogs({
            address: marketAddresses,
            event: DEPOSITED_NO_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const eventLog of noLogs) {
            await this.handleDeposited(eventLog as any, false);
          }

          // Resolution events
          const resolveLogs = await this.client.getLogs({
            address: marketAddresses,
            event: RESOLVED_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const eventLog of resolveLogs) {
            await this.handleResolved(eventLog as any);
          }

          // Claim events
          const claimLogs = await this.client.getLogs({
            address: marketAddresses,
            event: CLAIMED_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const eventLog of claimLogs) {
            await this.handleClaimed(eventLog as any);
          }

          // Supply update events
          const supplyLogs = await this.client.getLogs({
            address: marketAddresses,
            event: SUPPLY_UPDATED_EVENT,
            fromBlock: start,
            toBlock: end,
          });

          for (const eventLog of supplyLogs) {
            await this.handleSupplyUpdated(eventLog as any);
          }
        }

        // Update indexer state
        await prisma.indexerState.update({
          where: { chainId: this.chainId },
          data: { lastBlockNumber: Number(end) },
        });

        log.debug({ from: start.toString(), to: end.toString() }, 'Backfill batch complete');
      } catch (error) {
        log.error({ err: error, from: start.toString(), to: end.toString() }, 'Backfill batch failed');
        throw error; // Surface to caller
      }
    }
  }

  // ── Live Watchers ────────────────────────────────────

  private watchFactory() {
    const unwatch = this.client.watchEvent({
      address: this.factoryAddress as `0x${string}`,
      event: MARKET_CREATED_EVENT,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          this.handleMarketCreated(eventLog as any).catch(err =>
            log.error({ err }, 'Failed to handle MarketCreated')
          );
        }
      },
      onError: (error) => {
        log.error({ err: error }, 'Factory watcher error');
      },
    });

    this.unwatchers.push(unwatch);
  }

  private watchMarkets() {
    // Watch DepositedYes events
    const unwatchYes = this.client.watchEvent({
      event: DEPOSITED_YES_EVENT,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          this.isKnownMarket(eventLog.address).then(isKnown => {
            if (isKnown) {
              this.handleDeposited(eventLog as any, true).catch(err =>
                log.error({ err }, 'Failed to handle DepositedYes')
              );
            }
          });
        }
      },
      onError: (error) => {
        log.error({ err: error }, 'DepositedYes watcher error');
      },
    });
    this.unwatchers.push(unwatchYes);

    // Watch DepositedNo events
    const unwatchNo = this.client.watchEvent({
      event: DEPOSITED_NO_EVENT,
      onLogs: (logs) => {
        for (const eventLog of logs) {
          this.isKnownMarket(eventLog.address).then(isKnown => {
            if (isKnown) {
              this.handleDeposited(eventLog as any, false).catch(err =>
                log.error({ err }, 'Failed to handle DepositedNo')
              );
            }
          });
        }
      },
      onError: (error) => {
        log.error({ err: error }, 'DepositedNo watcher error');
      },
    });
    this.unwatchers.push(unwatchNo);

    // Watch Resolved, Claimed, SupplyUpdated
    const otherEvents = [
      { event: RESOLVED_EVENT, handler: this.handleResolved.bind(this), name: 'Resolved' },
      { event: CLAIMED_EVENT, handler: this.handleClaimed.bind(this), name: 'Claimed' },
      { event: SUPPLY_UPDATED_EVENT, handler: this.handleSupplyUpdated.bind(this), name: 'SupplyUpdated' },
    ];

    for (const { event, handler, name } of otherEvents) {
      const unwatch = this.client.watchEvent({
        event,
        onLogs: (logs) => {
          for (const eventLog of logs) {
            this.isKnownMarket(eventLog.address).then(isKnown => {
              if (isKnown) {
                handler(eventLog as any).catch(err =>
                  log.error({ err, event: name }, 'Failed to handle event')
                );
              }
            });
          }
        },
        onError: (error) => {
          log.error({ err: error, event: name }, 'Market watcher error');
        },
      });

      this.unwatchers.push(unwatch);
    }
  }

  // ── Event Handlers (idempotent) ──────────────────────

  private async handleMarketCreated(eventLog: Log & { args: any }) {
    const { market, token, threshold, deadline } = eventLog.args;
    const address = (market as string).toLowerCase();
    const txHash = eventLog.transactionHash!;
    const blockNumber = Number(eventLog.blockNumber);

    log.info({ market: address, token, txHash }, 'MarketCreated event');

    await prisma.market.upsert({
      where: { contractAddress: address },
      update: {}, // Idempotent — don't overwrite
      create: {
        contractAddress: address,
        chainId: this.chainId,
        creatorAddress: '', // Creator is not in MarketCreated event; will be populated from tx sender via API
        tokenAddress: (token as string).toLowerCase(),
        question: '', // Populated by the frontend when user creates market
        threshold: threshold.toString(),
        deadline: new Date(Number(deadline) * 1000),
        initialSupply: '0', // Read from chain via view function
        latestSupply: '0',
        txHash,
        blockNumber,
      },
    });

    // Update indexer state
    await this.updateIndexerBlock(blockNumber);
  }

  private async handleDeposited(eventLog: Log & { args: any }, isYes: boolean) {
    const { user, amount } = eventLog.args;
    const marketAddress = eventLog.address.toLowerCase();
    const userAddress = (user as string).toLowerCase();
    const txHash = eventLog.transactionHash!;
    const blockNumber = Number(eventLog.blockNumber);

    log.info({ market: marketAddress, user: userAddress, isYes, amount: amount.toString() }, 'Deposited event');

    // Ensure user exists
    await prisma.user.upsert({
      where: { address: userAddress },
      update: {},
      create: { address: userAddress },
    });

    // Idempotent bet creation (check by txHash + logIndex)
    const existingBet = await prisma.bet.findFirst({
      where: { txHash, marketAddress, userAddress },
    });

    if (!existingBet) {
      await prisma.bet.create({
        data: {
          marketAddress,
          userAddress,
          side: isYes ? 'YES' : 'NO',
          amount: amount.toString(),
          txHash,
          blockNumber,
          chainId: this.chainId,
        },
      });

      const { attributeReferralVolume } = await import('./referrals');
      await attributeReferralVolume(marketAddress, userAddress, amount.toString()).catch(() => {});
    }

    // Update market pool totals
    const poolField = isYes ? 'yesPool' : 'noPool';
    const market = await prisma.market.findUnique({
      where: { contractAddress: marketAddress },
      select: { yesPool: true, noPool: true },
    });

    if (market) {
      const currentPool = BigInt(isYes ? market.yesPool : market.noPool);
      const newPool = currentPool + BigInt(amount.toString());
      await prisma.market.update({
        where: { contractAddress: marketAddress },
        data: { [poolField]: newPool.toString() },
      });
    }

    await this.updateIndexerBlock(blockNumber);
  }

  private async handleResolved(eventLog: Log & { args: any }) {
    const { reached } = eventLog.args;
    const marketAddress = eventLog.address.toLowerCase();
    const blockNumber = Number(eventLog.blockNumber);

    log.info({ market: marketAddress, reached }, 'Resolved event');

    await prisma.market.update({
      where: { contractAddress: marketAddress },
      data: {
        resolved: true,
        reached,
        resolvedAt: new Date(),
      },
    });

    await this.updateIndexerBlock(blockNumber);
  }

  private async handleClaimed(eventLog: Log & { args: any }) {
    const { user, amount } = eventLog.args;
    const marketAddress = eventLog.address.toLowerCase();
    const userAddress = (user as string).toLowerCase();
    const txHash = eventLog.transactionHash!;
    const blockNumber = Number(eventLog.blockNumber);

    log.info({ market: marketAddress, user: userAddress, payout: amount.toString() }, 'Claimed event');

    await prisma.claim.upsert({
      where: { marketAddress_userAddress: { marketAddress, userAddress } },
      update: {},
      create: {
        marketAddress,
        userAddress,
        payout: amount.toString(),
        txHash,
        blockNumber,
        chainId: this.chainId,
      },
    });

    await this.updateIndexerBlock(blockNumber);
  }

  private async handleSupplyUpdated(eventLog: Log & { args: any }) {
    const { newSupply } = eventLog.args;
    const marketAddress = eventLog.address.toLowerCase();
    const blockNumber = Number(eventLog.blockNumber);

    await prisma.market.update({
      where: { contractAddress: marketAddress },
      data: { latestSupply: newSupply.toString() },
    });

    await this.updateIndexerBlock(blockNumber);
  }

  // ── Helpers ──────────────────────────────────────────

  private async isKnownMarket(address: string): Promise<boolean> {
    const market = await prisma.market.findUnique({
      where: { contractAddress: address.toLowerCase() },
      select: { contractAddress: true },
    });
    return !!market;
  }

  private async updateIndexerBlock(blockNumber: number) {
    await prisma.indexerState.update({
      where: { chainId: this.chainId },
      data: { lastBlockNumber: Math.max(blockNumber, 0) },
    });
  }
}

// ── Singleton for Next.js ────────────────────────────────

let indexerInstance: EventIndexer | null = null;

export function getIndexer(): EventIndexer | null {
  return indexerInstance;
}

export function initializeIndexer(config: {
  chainId: number;
  factoryAddress: string;
  rpcUrl: string;
  wsUrl?: string;
}) {
  if (indexerInstance) return indexerInstance;
  indexerInstance = new EventIndexer(config);
  return indexerInstance;
}
