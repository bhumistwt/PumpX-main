# Prediction Markets Integration Guide

## Overview

This implementation provides a complete frontend-only prediction market system for ERC20 tokens using bonding curve thresholds.

## Architecture

### Core Components

1. **AlchemyBaseClient** (`src/lib/AlchemyBaseClient.ts`)
   - Handles all RPC calls to Base via Alchemy
   - Fetches token metadata, total supply, and contract info
   - Type-safe with proper error handling

2. **useMarket Hook** (`src/hooks/useMarket.ts`)
   - Central state management for markets
   - Handles market creation, resolution, deposits, and withdrawals
   - Persists to localStorage

3. **CreateMarketModal** (`src/components/CreateMarketModal.tsx`)
   - 3-step wizard: Input → Validate → Configure
   - Real-time token validation
   - User-friendly error handling

4. **MarketCard** (`src/components/MarketCard.tsx`)
   - Displays individual market status
   - Live countdown timer
   - Progress bar showing threshold completion
   - Action buttons (Resolve, Withdraw, etc.)

5. **MarketsList** (`src/components/MarketsList.tsx`)
   - Main container component
   - Filterable market list
   - Integrates create modal

## Integration Steps

### 1. Environment Setup

Add to `.env.local`:
```env
NEXT_PUBLIC_ALCHEMY_API_KEY=your-alchemy-api-key-here
```

### 2. Simple Integration

Replace your existing "Create Market" button with:

```tsx
import { useState } from 'react';
import CreateMarketModal from '../components/CreateMarketModal';

function YourComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Create Market
      </button>

      <CreateMarketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(marketId) => {
          console.log('Market created:', marketId);
          // Navigate or show success message
        }}
      />
    </>
  );
}
```

### 3. Full Markets Page

Use the complete markets list page:

```tsx
import { useAccount } from 'wagmi';
import MarketsList from '../components/MarketsList';

export default function MarketsPage() {
  const { address } = useAccount();

  return <MarketsList userAddress={address} />;
}
```

## Market Lifecycle

### 1. Creation Flow

```
User clicks "Create Market"
  ↓
Enter token address
  ↓
Validate contract (checks if ERC20)
  ↓
Fetch metadata (name, symbol, decimals, creator, supply)
  ↓
Configure threshold & deadline
  ↓
Deploy market (creates local state)
```

### 2. Active Market

```
Monitor total supply every 10 seconds
  ↓
Update progress bar
  ↓
Check if threshold reached OR deadline passed
```

### 3. Resolution

**If threshold reached before deadline:**
- Market resolves TRUE
- Status: "Threshold Reached"
- UI shows "Subsequent Markets Available"
- Enable "Create Subsequent Market" button

**If deadline passes without reaching threshold:**
- Market resolves FALSE
- Status: "Failed"
- Users can withdraw full refund (no profit/loss)

### 4. Withdrawal

```
User has deposit in failed market
  ↓
Click "Withdraw Refund"
  ↓
Pull-based withdrawal
  ↓
Full refund returned
```

## Key Functions

### checkBondingCurveReached()

```typescript
const reached = await checkBondingCurveReached(tokenAddress, threshold);
// Returns true if totalSupply >= threshold
```

### createMarket()

```typescript
const market = await createMarket(
  tokenAddress: string,
  threshold: number,      // In token base units
  deadline: number        // Unix timestamp in ms
);
```

### resolveMarket()

```typescript
await resolveMarket(marketId);
// Checks threshold and updates market state
```

### withdrawRefund()

```typescript
const amount = withdrawRefund(marketId, userAddress);
// Only works for failed markets
// Returns deposited amount
```

## Error Handling

The system validates:
- ✓ Valid Ethereum address format
- ✓ Address is a contract
- ✓ Contract is ERC20 compliant
- ✓ Deadline is in future
- ✓ Threshold > current supply
- ✓ Market not already resolved
- ✓ User has deposits (for withdrawals)

## UI Features

### Progress Bar
- Shows current supply vs threshold
- Updates automatically every 10 seconds
- Visual feedback (blue → green when reached)

### Countdown Timer
- Live updates every second
- Shows days, hours, minutes, seconds
- Changes to "Expired" when deadline passes

### Status Badges
- 🔵 Active - Market is live
- 🟢 Threshold Reached - Success
- 🔴 Failed - Can withdraw
- 🟡 Expired - Needs resolution

### Market Filters
- All - Shows everything
- Active - Only live markets
- Resolved - Completed markets

## Data Persistence

Markets are stored in `localStorage` under key `prediction-markets`.

```typescript
interface Market {
  id: string;                    // Unique identifier
  tokenAddress: string;          // ERC20 contract
  tokenName: string;             // Token name
  tokenSymbol: string;           // Token symbol
  tokenDecimals: number;         // Decimals
  contractCreator: string;       // Deployer address
  totalSupply: string;           // Current supply
  threshold: number;             // Target supply
  deadline: number;              // Unix timestamp
  deposits: Record<string, number>; // User deposits
  resolved: boolean;             // Resolution status
  reached: boolean;              // Outcome
  createdAt: number;             // Creation time
  resolvedAt?: number;           // Resolution time
}
```

## TypeScript Types

All types are strictly defined in `src/types/market.ts`:

```typescript
Market          // Complete market object
TokenInfo       // Token metadata
MarketFormData  // Form input data
MarketStatus    // Enum for states
```

## Component Props

### CreateMarketModal
```typescript
interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (marketId: string) => void;
}
```

### MarketCard
```typescript
interface MarketCardProps {
  market: Market;
  userAddress?: string;
}
```

### MarketsList
```typescript
interface MarketsListProps {
  userAddress?: string;
}
```

## Future Enhancements

This is frontend MVP. For production, add:

1. Smart contract integration
2. On-chain deposits/withdrawals
3. Multi-collateral support
4. AMM for shares trading
5. Oracle integration for resolution
6. Subgraph for historical data
7. ENS support for token names
8. Social features (comments, votes)

## Testing Tokens on Base

Use these contracts for testing:

- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **WETH**: `0x4200000000000000000000000000000000000006`
- **DAI**: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`

## Support

For issues or questions, check:
- AlchemyBaseClient implementation
- Browser console for detailed errors
- Network tab for RPC call failures

---

**Built with:**
- React + TypeScript
- Wagmi for wallet connection
- Alchemy for Base RPC
- localStorage for persistence
- No dependencies on removed packages
