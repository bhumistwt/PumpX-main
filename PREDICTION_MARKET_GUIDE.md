# 🎲 Prediction Market Betting System

## Overview

A REAL prediction market where users bet USDC on whether pump.fun tokens will reach supply thresholds.

## How It Works

### For Market Creators:

1. **Select Token**
   - Get token contract from pump.fun site (e.g., RobinPump.fun)
   - Paste address in "Create Market" page

2. **Set Question**
   - Example: "Will PBNB hit 2 billion supply by Feb 19?"
   - Example: "Will DOGE reach 10B tokens before deadline?"

3. **Configure Market**
   - **Threshold**: Target token supply (e.g., 2,000,000,000)
   - **Deadline**: When market expires

4. **Deploy**
   - Market goes live
   - Users can start betting immediately

### For Bettors:

1. **Browse Markets**
   - Click "[View Markets]" in navbar
   - See all active prediction markets

2. **Place Bet**
   - Choose YES or NO
   - Enter USDC amount
   - Click "Place Bet"

3. **Wait for Resolution**
   - Market auto-resolves after deadline
   - If threshold reached before deadline: **YES wins**
   - If deadline passes without reaching: **NO wins**

4. **Claim Winnings**
   - Winning side splits the losing side's pool
   - Click "Claim Winnings" to get payout

## Betting Example

### Scenario:
**Question**: "Will PBNB reach 2B supply by Feb 19?"
- Current supply: 1B tokens
- Threshold: 2B tokens
- Deadline: Feb 19, 2026

### Betting:
- Alice bets 100 USDC on YES
- Bob bets 50 USDC on YES
- Charlie bets 200 USDC on NO
- Dave bets 100 USDC on NO

**Pools:**
- YES Pool: 150 USDC (Alice + Bob)
- NO Pool: 300 USDC (Charlie + Dave)
- Total: 450 USDC

### If YES Wins (threshold reached):

**Payout Formula:**
```
Your Payout = Your Bet + (Your Bet / Winning Pool) × Losing Pool
```

**Alice's Payout:**
```
100 + (100 / 150) × 300 = 100 + 200 = 300 USDC
Alice wins 200 USDC profit! (3x return)
```

**Bob's Payout:**
```
50 + (50 / 150) × 300 = 50 + 100 = 150 USDC
Bob wins 100 USDC profit! (3x return)
```

**Charlie & Dave:**
```
Lose their bets (0 USDC)
```

### If NO Wins (threshold not reached):

**Charlie's Payout:**
```
200 + (200 / 300) × 150 = 200 + 100 = 300 USDC
Charlie wins 100 USDC profit! (1.5x return)
```

**Dave's Payout:**
```
100 + (100 / 300) × 150 = 100 + 50 = 150 USDC
Dave wins 50 USDC profit! (1.5x return)
```

**Alice & Bob:**
```
Lose their bets (0 USDC)
```

## Features

### ✅ Market Creation
- Create markets for any ERC20 token
- Set custom questions
- Define threshold and deadline

### ✅ Betting Interface
- Bet YES or NO
- Enter any USDC amount
- See live pool sizes
- View odds (YES% vs NO%)

### ✅ Live Stats
- Real-time token supply tracking
- Progress bar to threshold
- Countdown timer
- Pool percentages

### ✅ User Dashboard
- See your bets (YES and NO amounts)
- Track your positions
- View all markets you've bet on

### ✅ Resolution & Payouts
- Automatic resolution after deadline
- Winner takes all losing side's pool
- Proportional payout based on bet size
- One-click claim winnings

## USDC Integration

### Contract Address (Base Sepolia):
```
0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### How Betting Works:
1. User approves USDC spending
2. User places bet (USDC transferred)
3. Bet recorded in market
4. On resolution, winners claim proportional payouts

### MVP Note:
Currently using localStorage for bet tracking. In production:
- Deploy smart contract to hold USDC
- Store bets on-chain
- Automatic payout distribution

## UI Features

### Market Card Shows:
- ❓ Prediction question
- 📊 Token supply progress
- 💰 YES and NO pools
- ⏱️ Time remaining
- 🎯 Your bets
- 🎲 Betting interface

### Color Coding:
- 🟢 Green = YES pool/bets
- 🔴 Red = NO pool/bets
- 🟡 Lime = Active market
- ⚫ Gray = Expired/Resolved

## Getting Started

1. **Get USDC on Base Sepolia**
   - Use faucet or bridge
   - Contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

2. **Create Market**
   - Click "[Prediction Markets]"
   - Enter pump.fun token address
   - Set question and threshold
   - Deploy

3. **Place Bets**
   - Click "[View Markets]"
   - Choose a market
   - Pick YES or NO
   - Enter USDC amount
   - Place bet

4. **Win Big!**
   - Wait for resolution
   - Claim your winnings
   - Repeat!

## Example Markets

### Pump.Fun Token Examples:

**Market 1:**
- Question: "Will PBNB hit 2B supply by Feb 19?"
- Token: PetsBNB (PBNB)
- Current: 1B
- Threshold: 2B
- Deadline: Feb 19, 2026

**Market 2:**
- Question: "Will DOGE2.0 reach 10B before March?"
- Token: DOGE2.0
- Current: 5B
- Threshold: 10B
- Deadline: Mar 1, 2026

**Market 3:**
- Question: "Will PEPE pump to 100B this week?"
- Token: PEPE
- Current: 50B
- Threshold: 100B
- Deadline: Feb 18, 2026

## Smart Contract (Production)

For production deployment, you'll need:

1. **Market Contract**
   - Hold USDC deposits
   - Track bets
   - Resolve markets
   - Distribute payouts

2. **Oracle Integration**
   - Fetch token supply at deadline
   - Trigger resolution
   - Ensure fair outcomes

3. **Features**
   - Market fee (e.g., 2% to platform)
   - Liquidity pools
   - Early exit options
   - Market maker bonuses

## Current Status: MVP

✅ Working:
- Market creation
- Token validation
- Question/threshold setting
- Betting UI
- Pool tracking
- Resolution logic
- Payout calculation

⚠️ Mock (LocalStorage):
- Bet storage
- USDC transfers
- Payouts

🚧 To Build:
- Smart contracts
- On-chain bets
- Real USDC integration
- Oracle for resolution

---

**Start betting on pump.fun tokens now!** 🚀
