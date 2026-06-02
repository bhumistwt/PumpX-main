PumpX — Decentralized Prediction Markets for Degens
Permissionless. On-Chain. Open to Everyone.
Live on Base ·

What is PumpX?
PumpX is an open, decentralized prediction market platform where anyone can create and trade on bets — with zero restrictions, no oracle gatekeeping, and full on-chain transparency.

Unlike existing platforms that lock users into predefined topics or oracle frameworks, PumpX lets you create a market on anything — any ERC-20 token, any real-world event, any condition you define.


Problem Statement
Prediction markets are powerful, but most platforms make them frustrating to use:

Too Many Restrictions — Platforms like Polymarket only support markets backed by specific oracles (like UMA). If your idea doesn't fit their framework, you're out of luck.
Complicated Resolutions — Outcomes can be slow and opaque to resolve, creating uncertainty and user frustration.
No Creative Freedom — Want to create a market on a real-world event like a presidential election? Too bad — if the result isn't available in their oracle data, you simply can't.

During the 2024 U.S. election between Kamala Harris and Donald Trump, users wanted to create prediction markets on the outcome — but platforms like Polymarket blocked it because the result wasn't available through their oracle infrastructure. PumpX removes that wall entirely.


Vision
At PumpX, we believe prediction markets should be open to everyone and easy to use. Our platform gives users full control to:

Create markets on any topic they care about
Resolve outcomes using verifiable on-chain data
Trade with full transparency and fairness

Our ultimate goal: make prediction markets fun, flexible, and accessible to all.


Features
Feature
Description
Permissionless Markets
Create prediction markets on any ERC-20 token or topic. No gatekeeping.
On-Chain Resolution
Markets resolve transparently using verifiable on-chain supply data.
Instant Settlement
Claim winnings immediately after resolution — no delays, no intermediaries.
Non-Custodial
Your funds stay in audited smart contracts. Full self-custody at all times.
Real-Time Analytics
Live market depth, whale tracking, and sentiment visualization.
Multi-Chain Ready
Deployed on Base with expansion to Arbitrum, Mantle, and more.
ML Pipeline
On-chain data intelligence layer for market insights and predictions.



How It Works
01 → Enter Token          Paste any ERC-20 contract address to validate

02 → Set Conditions       Define supply threshold and deadline

03 → Deploy On-Chain      Smart contract created via MarketFactory

04 → Trade & Resolve      Bet YES/NO with ETH, claim your winnings


User Flow



Project Structure
PumpX-main/

├── frontend/          # Next.js + React frontend

├── contract/          # Solidity smart contracts (Foundry)

├── ml_pipeline/       # Python ML pipeline for market intelligence

├── prisma/            # Prisma ORM + Supabase DB schema

└── components.json    # UI component config


Tech Stack
Layer
Technology
Frontend
Next.js · React · TypeScript · JavaScript
Smart Contracts
Solidity · Foundry
Database / Backend
Supabase · Prisma ORM
ML / Intelligence
Python · Cython · C/C++
Blockchain
Base Mainnet · Base Sepolia


Language breakdown: Python 96.1% · Cython 2.6% · C 0.7% · TypeScript 0.3% · C++ 0.2% · JavaScript 0.1%


Getting Started
Prerequisites
Node.js 18+
A wallet with Base ETH (for gas)
Foundry (for contract development)
Python 3.10+ (for ML pipeline)
Frontend Setup
# Clone the repo

git clone https://github.com/bhumistwt/PumpX-main

cd PumpX-main

# Install dependencies

npm install

# Run the dev server

npm run dev
Smart Contract Deployment
cd contract

# Build & test

forge build

forge test

# Deploy to Base

forge script script/Deploy.s.sol --rpc-url base --broadcast
ML Pipeline
cd ml_pipeline

pip install -r requirements.txt

python main.py
Database Setup
# Run Prisma migrations

npx prisma migrate dev

npx prisma generate


Live Links
Page
URL
Home
pump-x-main.vercel.app
Create Market
/markets
Explore Markets
/markets/view
Analytics
/analytics
Leaderboard
/leaderboard



Network Support
Network
Status
Base Mainnet
Live
Base Sepolia (Testnet)
Live
Arbitrum
Coming Soon
Mantle
Coming Soon



Contributor

@bhumistwt
Bhumi Mishra — Creator & Lead Developer



License
MIT License. See LICENSE for details.
