/**
 * PumpX — Compile & Deploy MarketFactoryV2
 *
 * Usage:
 *   set DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
 *   node scripts/deploy.js base          # Base Mainnet
 *   node scripts/deploy.js base-sepolia  # Base Sepolia
 */
const path = require("path");
const fs = require("fs");
const solc = require("solc");
const { ethers } = require("ethers");

// ── Network configs ──────────────────────────────
const NETWORKS = {
    base: {
        url: "https://base-rpc.publicnode.com",
        chainId: 8453,
        name: "Base Mainnet",
    },
    "base-sepolia": {
        url: "https://base-sepolia-rpc.publicnode.com",
        chainId: 84532,
        name: "Base Sepolia",
    },
};

// ── Compile Solidity ─────────────────────────────
function compileSolidity() {
    console.log("Compiling Solidity contracts...\n");

    const contractDir = path.resolve(__dirname, "..");

    // Read V2 .sol files only (V1 has build issues)
    const sources = {};
    const v2Files = ["MarketFactoryV2.sol", "MilestoneMarketV2.sol"];
    for (const file of v2Files) {
        const fp = path.join(contractDir, file);
        if (!fs.existsSync(fp)) {
            console.error(`ERROR: ${file} not found in ${contractDir}`);
            process.exit(1);
        }
        sources[file] = { content: fs.readFileSync(fp, "utf8") };
    }

    const input = {
        language: "Solidity",
        sources,
        settings: {
            optimizer: { enabled: true, runs: 200 },
            outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
        },
    };

    // Resolve imports — handle @openzeppelin imports from node_modules
    function findImports(importPath) {
        const candidates = [
            path.join(contractDir, importPath),
            path.join(contractDir, "node_modules", importPath),
        ];
        for (const p of candidates) {
            if (fs.existsSync(p)) {
                return { contents: fs.readFileSync(p, "utf8") };
            }
        }
        return { error: `File not found: ${importPath}` };
    }

    const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

    if (output.errors) {
        const fatal = output.errors.filter((e) => e.severity === "error");
        if (fatal.length > 0) {
            console.error("Compilation errors:");
            fatal.forEach((e) => console.error("  ", e.formattedMessage));
            process.exit(1);
        }
        // Show warnings
        output.errors.filter((e) => e.severity === "warning").forEach((e) => console.warn("  WARNING:", e.message));
    }

    const factoryContract = output.contracts["MarketFactoryV2.sol"]["MarketFactoryV2"];
    console.log("  MarketFactoryV2 compiled successfully!");
    console.log(`  Bytecode size: ${factoryContract.evm.bytecode.object.length / 2} bytes\n`);

    return {
        abi: factoryContract.abi,
        bytecode: "0x" + factoryContract.evm.bytecode.object,
    };
}

// ── Deploy ───────────────────────────────────────
async function deploy() {
    const networkName = process.argv[2] || "base";
    const network = NETWORKS[networkName];

    if (!network) {
        console.error(`Unknown network: ${networkName}`);
        console.error(`Available: ${Object.keys(NETWORKS).join(", ")}`);
        process.exit(1);
    }

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) {
        console.error("ERROR: Set DEPLOYER_PRIVATE_KEY environment variable");
        console.error("  PowerShell: $env:DEPLOYER_PRIVATE_KEY = '0xYOUR_KEY'");
        console.error("  CMD:        set DEPLOYER_PRIVATE_KEY=0xYOUR_KEY");
        process.exit(1);
    }

    // Compile
    const { abi, bytecode } = compileSolidity();

    // Connect
    console.log(`Deploying to ${network.name} (chainId: ${network.chainId})...`);
    const provider = new ethers.JsonRpcProvider(network.url, network.chainId);
    const wallet = new ethers.Wallet(privateKey, provider);

    const balance = await provider.getBalance(wallet.address);
    console.log(`  Deployer: ${wallet.address}`);
    console.log(`  Balance:  ${ethers.formatEther(balance)} ETH\n`);

    if (balance === 0n) {
        console.error("ERROR: Wallet has 0 ETH. Fund it first!");
        process.exit(1);
    }

    // Deploy
    console.log("Sending deployment transaction...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();

    console.log(`  Tx hash: ${contract.deploymentTransaction().hash}`);
    console.log("  Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log(`\n${"=".repeat(50)}`);
    console.log(`  MarketFactoryV2 DEPLOYED!`);
    console.log(`  Address: ${address}`);
    console.log(`  Network: ${network.name}`);
    console.log(`  Explorer: https://${networkName === "base" ? "basescan.org" : "sepolia.basescan.org"}/address/${address}`);
    console.log(`${"=".repeat(50)}\n`);

    console.log("Next steps:");
    console.log(`  1. Add to frontend/.env.local:`);
    if (networkName === "base") {
        console.log(`     NEXT_PUBLIC_FACTORY_ADDRESS_BASE=${address}`);
    } else {
        console.log(`     NEXT_PUBLIC_FACTORY_ADDRESS=${address}`);
    }
    console.log(`  2. Restart the dev server (npm run dev)`);
    console.log(`  3. Create markets on ${network.name}!\n`);

    // Save deployment info
    const deployInfo = {
        address,
        network: networkName,
        chainId: network.chainId,
        deployer: wallet.address,
        timestamp: new Date().toISOString(),
        txHash: contract.deploymentTransaction().hash,
    };
    const deployDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir);
    fs.writeFileSync(
        path.join(deployDir, `${networkName}.json`),
        JSON.stringify(deployInfo, null, 2)
    );
    console.log(`Deployment info saved to deployments/${networkName}.json`);
}

deploy().catch((err) => {
    console.error("\nDeployment failed:", err.message);
    process.exit(1);
});
