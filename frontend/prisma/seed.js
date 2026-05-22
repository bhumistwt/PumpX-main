/**
 * PumpX — Database Seed Script (plain CJS)
 * Run: node prisma/seed.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO_CREATOR = '0xc9b1d42c1e5e21e063bfcd9c9e4c28c68168063';

const SAMPLE_MARKETS = [
    {
        contractAddress: '0xaaaa000000000000000000000000000000000001',
        chainId: 84532,
        tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        question: 'Will USDC supply on Base exceed 500M tokens by March 31, 2025?',
        threshold: '500000000000000',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        initialSupply: '420000000000000',
        latestSupply: '437000000000000',
        yesPool: '1500000000000000000',
        noPool: '800000000000000000',
        resolved: false, reached: false,
        txHash: '0xaaaa' + 'a'.repeat(60),
        blockNumber: 12345678,
        stockTicker: null,
    },
    {
        contractAddress: '0xaaaa000000000000000000000000000000000002',
        chainId: 84532,
        tokenAddress: '0x4200000000000000000000000000000000000006',
        question: 'Will WETH total supply on Base Sepolia surpass 10,000 ETH by April 2025?',
        threshold: '10000000000000000000000',
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        initialSupply: '7800000000000000000000',
        latestSupply: '8400000000000000000000',
        yesPool: '3200000000000000000',
        noPool: '1100000000000000000',
        resolved: false, reached: false,
        txHash: '0xbbbb' + 'b'.repeat(60),
        blockNumber: 12345679,
        stockTicker: null,
    },
    {
        contractAddress: '0xaaaa000000000000000000000000000000000003',
        chainId: 84532,
        tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        question: 'Will Coinbase (COIN) stock price exceed $350 by end of Q1 2025?',
        threshold: '35000000000',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        initialSupply: '28000000000',
        latestSupply: '31500000000',
        yesPool: '5800000000000000000',
        noPool: '2400000000000000000',
        resolved: false, reached: false,
        txHash: '0xcccc' + 'c'.repeat(60),
        blockNumber: 12345680,
        stockTicker: 'COIN',
    },
    {
        contractAddress: '0xaaaa000000000000000000000000000000000004',
        chainId: 84532,
        tokenAddress: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        question: 'Will AAPL market cap remain above $3T through March 2025?',
        threshold: '300000000000000000',
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        initialSupply: '290000000000000000',
        latestSupply: '305000000000000000',
        yesPool: '2100000000000000000',
        noPool: '1900000000000000000',
        resolved: true, reached: true,
        txHash: '0xdddd' + 'd'.repeat(60),
        blockNumber: 12345681,
        stockTicker: 'AAPL',
    },
    {
        contractAddress: '0xaaaa000000000000000000000000000000000005',
        chainId: 84532,
        tokenAddress: '0x4200000000000000000000000000000000000006',
        question: 'Will TSLA stock drop below $200 before April 1, 2025?',
        threshold: '20000000000',
        deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        initialSupply: '25000000000',
        latestSupply: '23000000000',
        yesPool: '700000000000000000',
        noPool: '4200000000000000000',
        resolved: false, reached: false,
        txHash: '0xeeee' + 'e'.repeat(60),
        blockNumber: 12345682,
        stockTicker: 'TSLA',
    },
];

async function main() {
    console.log('Seeding PumpX database...\n');

    await prisma.user.upsert({
        where: { address: DEMO_CREATOR },
        update: {},
        create: { address: DEMO_CREATOR, role: 'ADMIN' },
    });
    console.log('✓ Demo admin user: ' + DEMO_CREATOR);

    for (const m of SAMPLE_MARKETS) {
        await prisma.market.upsert({
            where: { contractAddress: m.contractAddress },
            update: { yesPool: m.yesPool, noPool: m.noPool, resolved: m.resolved, reached: m.reached },
            create: {
                contractAddress: m.contractAddress,
                chainId: m.chainId,
                creatorAddress: DEMO_CREATOR,
                tokenAddress: m.tokenAddress,
                question: m.question,
                threshold: m.threshold,
                deadline: m.deadline,
                initialSupply: m.initialSupply,
                latestSupply: m.latestSupply,
                yesPool: m.yesPool,
                noPool: m.noPool,
                resolved: m.resolved,
                reached: m.reached,
                txHash: m.txHash,
                blockNumber: m.blockNumber,
                stockTicker: m.stockTicker,
            },
        });
        console.log('  ✓ ' + m.question.slice(0, 65) + '...');
    }

    console.log('\nDone! Visit http://localhost:3000/markets/view');
}

main()
    .catch(e => { console.error('Seed failed:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
