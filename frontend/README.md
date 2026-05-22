# PumpX — Decentralized Financial Intelligence Platform

> **Track:** Financial & Market Intelligence  
> **Team:** BEDSHEET — Parul University  
> **Members:** Bhumi Mishra · Prem Diwan · Ashwin Pandey  
> **Event:** Consensus 2026

---

## What is PumpX?

PumpX is a **permissionless prediction market protocol** that lets anyone create binary outcome markets on any ERC-20 token's supply trajectory. Users stake ETH on YES / NO positions and earn from accurate forecasts — all resolved transparently using verifiable on-chain token supply data.

**Core thesis:** Pump.fun proved there's massive demand for token speculation. PumpX channels that energy into structured, transparent markets with real financial intelligence.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Next.js)             │
│  ┌───────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Dashboard  │ │ Markets  │ │  Analytics     │  │
│  │           │ │ Create   │ │  Leaderboard   │  │
│  └─────┬─────┘ └────┬─────┘ └───────┬────────┘  │
│        │            │               │            │
│        └────────────┼───────────────┘            │
│                     │                            │
│              ┌──────┴──────┐                     │
│              │  wagmi/viem │  (RainbowKit)        │
│              └──────┬──────┘                     │
└─────────────────────┼───────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │    Base L2 Network    │
          │                       │
          │  MarketFactory ──────► MilestoneMarket (per market)
          │   - createMarket()    │  - buyYes() / buyNo()
          │   - creator registry  │  - resolve() via supply check
          │   - fee collection    │  - dispute() mechanism
          │                       │  - refund() auto-timeout
          │  Alchemy RPC ────────► Token supply validation
          └───────────────────────┘
```

### Key Data Flows

1. **Market Creation:** User fills form → `MarketFactory.createMarket()` deploys a new `MilestoneMarket` contract → stored in localStorage + on-chain
2. **Betting:** User stakes ETH → `MilestoneMarket.buyYes()` or `buyNo()` → pool updates, shares minted
3. **Resolution:** Creator calls `resolve()` → contract reads live token supply from Alchemy → compares against threshold → distributes pool to winners
4. **Dispute (V2):** 48-hour window post-resolution for arbitration claims

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (Pages Router) | SSR/SSG, routing |
| **Styling** | Tailwind CSS + custom design system | Bloomberg-grade dark UI |
| **Wallet** | RainbowKit + wagmi + viem | Wallet connection, tx signing |
| **Chain** | Base (L2) | Low-cost, Coinbase-aligned |
| **Contracts** | Solidity 0.8.20 + OpenZeppelin | Prediction market logic |
| **Data** | Alchemy SDK | Real-time token supply/metadata |
| **Storage** | localStorage (demo) / Supabase (prod) | Market metadata persistence |

---

## Feature Set

### Core Protocol
- **Permissionless market creation** — any ERC-20 token on Base
- **Binary outcome betting** — YES/NO with ETH stakes
- **On-chain resolution** — verifiable token supply comparison
- **Non-custodial** — funds in audited smart contracts

### Intelligence Layer
- **Real-time analytics dashboard** — 7-day trends, sentiment gauge, whale tracking
- **Leaderboard** — top predictors ranked by PnL, win rate, volume
- **Market search & filtering** — instant search across all markets

### Smart Contract V2 Improvements
- **Dispute mechanism** — 48h arbitration window post-resolution
- **Auto-refund** — 30-day grace period timeout with automatic refunds
- **Access control** — creator-only `updateSupply()`, `onlyCreator` modifier
- **Safe ETH transfers** — `call{value}` instead of `transfer()` (gas-safe)
- **Emergency pause** — circuit breaker for critical situations
- **Creator registry** — factory tracks all creators and their markets
- **Protocol fees** — optional creation fee collection

### UX Polish
- **Transaction feedback overlay** — pending/success/error states with animations
- **Sentiment visualization** — YES/NO percentage bars on every market card
- **Glass morphism navigation** — scroll-aware navbar with blur effects
- **Responsive design** — mobile-first, works on all screen sizes
- **Skeleton loaders** — smooth loading states

---

## Quick Start

```bash
# Clone
git clone https://github.com/Meet2054/Consensus_HK.git
cd Consensus_HK/frontend

# Install
npm install

# Configure
cp .env.example .env.local
# Add your NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

# Run
npm run dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Yes | Alchemy API key for Base RPC |

---

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── index.tsx          # Landing page
│   │   ├── dashboard.tsx      # User dashboard
│   │   ├── analytics.tsx      # Protocol analytics
│   │   ├── leaderboard.tsx    # Top predictors
│   │   ├── markets/
│   │   │   ├── index.tsx      # 4-step market creation
│   │   │   └── view.tsx       # Browse all markets
│   │   ├── _app.tsx           # App layout wrapper
│   │   └── _document.js       # HTML document config
│   ├── components/
│   │   ├── Navbar.tsx         # Main navigation
│   │   ├── Footer.tsx         # Footer w/ links
│   │   ├── MarketCard.tsx     # Individual market card + betting
│   │   ├── MarketsList.tsx    # Filterable market list
│   │   └── ui/
│   │       └── primitives.tsx # Reusable UI components
│   ├── constants/
│   │   └── contracts.ts       # Contract addresses + ABIs
│   ├── styles/
│   │   └── globals.css        # Design system (CSS variables)
│   └── utils/
│       └── AlchemyBaseClient.ts # Token supply/metadata queries
├── contract/
│   ├── MilestoneMarket.sol    # V1 market contract (deployed)
│   ├── Market.sol             # V1 factory (deployed)
│   ├── MilestoneMarketV2.sol  # V2 with dispute + refund
│   └── MarketFactoryV2.sol    # V2 factory with registry
└── tailwind.config.js         # Design tokens
```

---

## Roadmap

### Phase 1 — Hackathon MVP (Current)
- [x] Permissionless market creation on Base
- [x] Binary YES/NO betting with ETH
- [x] On-chain resolution via token supply
- [x] Production-grade UI/UX
- [x] Analytics & leaderboard pages
- [x] V2 smart contracts (dispute, refund, access control)

### Phase 2 — Post-Hackathon (1-2 months)
- [ ] Deploy V2 contracts to Base Sepolia → Mainnet
- [ ] Subgraph indexing (The Graph) for real-time event data
- [ ] Supabase integration for persistent market metadata
- [ ] Multi-chain expansion (Arbitrum, Mantle)
- [ ] Oracle integration for external data sources

### Phase 3 — Growth (3-6 months)
- [ ] Liquidity mining / LP incentives
- [ ] Governance token + DAO voting on disputes
- [ ] Mobile app (React Native)
- [ ] API for programmatic market creation
- [ ] Portfolio tracking + P&L visualization

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Reentrancy | OpenZeppelin `ReentrancyGuard` on all monetary functions |
| Gas griefing | `call{value}` instead of `transfer()` for ETH sends |
| Resolution manipulation | Only market creator can resolve; dispute mechanism in V2 |
| Stale markets | Auto-refund after 30-day grace period |
| Rug resolution | 48-hour dispute window for community arbitration |

---

## Contracts

### Deployed (V1)
| Contract | Address | Network |
|----------|---------|---------|
| MarketFactory | `0x3b4774D45De4e271f857cAa7830Ee283bD7Bf544` | Base |

### Ready for Deployment (V2)
- `MilestoneMarketV2.sol` — Enhanced with dispute, refund, pause, safe transfers
- `MarketFactoryV2.sol` — Creator registry, fee collection, ownership transfer

---

## Team BEDSHEET

| Name | Role |
|------|------|
| **Bhumi Mishra** | Smart Contract & Protocol Design |
| **Prem Diwan** | Frontend & UX Architecture |
| **Ashwin Pandey** | Full-Stack & Infrastructure |

**University:** Parul University  
**Built at:** Consensus Hackathon 2026

---

## License

MIT
