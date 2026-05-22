# PumpX Production Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Next.js)                       │
├─────────┬─────────┬─────────┬──────────┬───────────────────┤
│ wagmi   │Rainbow- │Gamifica-│ AI Chat  │  Market Pages     │
│ v2      │Kit v2   │tion UI  │ Panel    │  (SSR/CSR)        │
├─────────┴─────────┴─────────┴──────────┴───────────────────┤
│                   apiClient.ts (fetch)                      │
│         Typed API client with auth session cookies          │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS (same-origin)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEXT.JS API ROUTES                         │
├─────────────────────────────────────────────────────────────┤
│  Middleware Stack:                                          │
│  ┌─────────────┐ ┌──────────┐ ┌───────────┐ ┌───────────┐ │
│  │ withError   │→│ withAuth │→│ withValid  │→│ withRate  │ │
│  │ Handler     │ │ (SIWE)   │ │ (Zod)      │ │ Limit     │ │
│  └─────────────┘ └──────────┘ └───────────┘ └───────────┘ │
├──────────┬──────────┬────────────┬──────────┬──────────────┤
│ Auth     │ Markets  │Gamification│ Leader-  │ Health       │
│ (SIWE)   │ CRUD     │ XP/Badges  │ board    │ Check        │
│ nonce    │ index    │ Streaks    │          │              │
│ verify   │ [addr]   │ Challenges │          │              │
│ me       │          │ Battles    │          │              │
│ logout   │          │ Squads     │          │              │
│          │          │ Seasons    │          │              │
│          │          │ Reputation │          │              │
└──────┬───┴──────┬───┴────────┬───┴──────────┴──────────────┘
       │          │            │
       ▼          ▼            ▼
┌──────────┐ ┌─────────┐ ┌──────────────────────────────────┐
│iron-     │ │ Prisma  │ │  Event Indexer (viem WebSocket)   │
│session   │ │ ORM     │ │  Watches: MarketCreated,          │
│(cookie   │ │         │ │  DepositedYes/No, Resolved,       │
│encrypted)│ │         │ │  Claimed, SupplyUpdated            │
└──────────┘ └────┬────┘ └──────────┬───────────────────────┘
                  │                 │
                  ▼                 │
        ┌─────────────────┐        │
        │   PostgreSQL    │◄───────┘
        │   (Prisma)      │
        ├─────────────────┤
        │ Users           │
        │ Markets         │
        │ Bets            │
        │ Claims          │
        │ XPTransactions  │
        │ Streaks         │
        │ UserBadges      │
        │ Reputation      │
        │ Seasons         │
        │ Squads          │
        │ Battles         │
        │ Challenges      │
        │ IndexerState    │
        └─────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    BASE SEPOLIA CHAIN                        │
├─────────────────────────────────────────────────────────────┤
│  MarketFactoryV2 (0x3b4774...Bf544)                        │
│  └── MilestoneMarketV2 (clones)                            │
│      Events: MarketCreated, DepositedYes, DepositedNo,     │
│              Resolved, Claimed, SupplyUpdated               │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Flow (SIWE)

```
Client                           Server
  │                                │
  │ GET /api/auth/nonce            │
  │ ──────────────────────────────>│
  │   {nonce: "abc123"}            │
  │ <──────────────────────────────│
  │                                │
  │ wallet.signMessage(siweMsg)    │
  │ (user signs in wallet)         │
  │                                │
  │ POST /api/auth/verify          │
  │ {message, signature}           │
  │ ──────────────────────────────>│
  │   SIWE.verify() ──> User upsert
  │   Set-Cookie: session          │
  │   {ok:true, address}           │
  │ <──────────────────────────────│
  │                                │
  │ (subsequent requests include   │
  │  encrypted session cookie)     │
```

## Data Flow: Prediction Market Lifecycle

```
1. CREATE: User calls MarketFactoryV2.createMarket(token, question, threshold, deadline)
   └── Emits MarketCreated event
       └── Indexer catches → INSERT Market row in PostgreSQL
       └── Frontend calls POST /api/markets to register metadata

2. BET: User calls MilestoneMarketV2.depositYes/depositNo(amount)  
   └── Emits DepositedYes/DepositedNo event
       └── Indexer catches → INSERT Bet row
       └── Frontend triggers onBetPlaced() → server awards XP, checks badges

3. RESOLVE: Oracle calls MilestoneMarketV2.resolve()
   └── Emits Resolved(bool reached) event
       └── Indexer catches → UPDATE Market.resolved = true

4. CLAIM: User calls MilestoneMarketV2.claim()
   └── Emits Claimed(address, payout) event
       └── Indexer catches → INSERT Claim row
       └── If won → server awards XP, checks badges, updates reputation
```

## File Structure (Post-Refactor)

```
frontend/
├── prisma/schema.prisma          # PostgreSQL schema (15 models)
├── .env.example                  # All required environment variables
├── src/
│   ├── server/                   # Server-only modules
│   │   ├── db.ts                 # Prisma singleton
│   │   ├── logger.ts             # Pino structured logging
│   │   ├── session.ts            # iron-session v8 config
│   │   ├── middleware.ts         # Auth, validation, rate-limit, error handling
│   │   ├── chains.ts             # Dynamic chain config (Base/Base Sepolia)
│   │   ├── validation.ts         # Zod schemas for all API inputs
│   │   └── indexer.ts            # On-chain event indexer (viem WebSocket)
│   ├── pages/api/                # API routes (13 endpoints)
│   │   ├── auth/{nonce,verify,me,logout}.ts
│   │   ├── markets/{index,[address]}.ts
│   │   ├── leaderboard.ts
│   │   ├── gamification/{xp,streaks,badges,challenges,battles,reputation,seasons}.ts
│   │   ├── gamification/squads/{index,[id]}.ts
│   │   └── health.ts
│   ├── lib/
│   │   ├── apiClient.ts          # Typed fetch client for all API calls
│   │   ├── gamification/
│   │   │   ├── index.ts          # Barrel: re-exports types + constants only
│   │   │   ├── types.ts          # Complete type definitions
│   │   │   └── constants.ts      # XP values, level defs, badge defs
│   │   └── ai/                   # AI chat function definitions
│   ├── hooks/                    # React hooks (all API-backed)
│   │   ├── useAuth.ts            # SIWE authentication
│   │   ├── useGamification.tsx   # Context provider + action triggers
│   │   ├── useXP.ts              # XP & level data
│   │   ├── useStreak.ts          # Daily streak tracking
│   │   ├── useBadges.ts          # Badge collection
│   │   ├── useChallenges.ts      # Daily challenges
│   │   ├── useBattles.ts         # PvP battles
│   │   ├── useSquad.ts           # Squad management
│   │   └── useSeason.ts          # Season data
│   └── components/gamification/  # UI components (all use API hooks)
│       ├── XPBar.tsx
│       ├── StreakCounter.tsx
│       ├── BadgeShowcase.tsx
│       ├── DailyChallenges.tsx
│       ├── SeasonBanner.tsx
│       ├── SquadPanel.tsx
│       ├── BattleCard.tsx
│       ├── GamificationDashboard.tsx
│       └── NotificationToast.tsx  # Stub (pending server push)
```

---

## Migration Plan

### Phase 1: Database Setup (Day 1)
1. Provision PostgreSQL instance (Supabase, Neon, or Railway)
2. Set `DATABASE_URL` in `.env`
3. Run `npx prisma migrate dev --name init` to create all tables
4. Run `npx prisma generate` to generate the Prisma client

### Phase 2: Session & Auth (Day 1)
1. Generate a 32-char `SESSION_SECRET` (`openssl rand -hex 16`)
2. Test SIWE flow: GET /api/auth/nonce → sign → POST /api/auth/verify
3. Verify GET /api/auth/me returns the authenticated wallet address

### Phase 3: Event Indexer (Day 2)
1. Start the indexer (either standalone or on first API request)
2. Verify it catches historical MarketCreated events
3. Confirm Market rows appear in PostgreSQL
4. Test with a new on-chain bet → verify Bet row created

### Phase 4: Gamification Data Migration (Day 2-3)
- **No migration needed** — the old system was 100% localStorage with seeded fake data
- Fresh start with real data from real on-chain activity
- All XP, badges, streaks will accumulate from actual user actions

### Phase 5: Frontend Verification (Day 3)
1. Connect wallet → verify SIWE auth works
2. Create a market → verify it appears in the DB + UI
3. Place a bet → verify XP awarded, streak updated
4. Check all gamification pages render without errors

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Database goes down | High | Use managed PostgreSQL (Supabase/Neon) with automated backups |
| Session secret exposed | Critical | Store in environment variables, never commit to git |
| RPC rate limits (Base) | Medium | Use paid RPC providers (Alchemy/Infura), implement retry logic |
| Event indexer misses events | Medium | IndexerState tracks last processed block; restart catches up |
| XP manipulation via API | Medium | All gamification routes require SIWE auth; rate limiting in place |
| Prisma connection pool exhaustion | Medium | Singleton pattern prevents multiple client instances |
| iron-session cookie theft | Low | Cookies are encrypted, httpOnly, sameSite: lax |
| viem/wagmi version drift | Low | Pin exact versions in package.json |

---

## Production Readiness Checklist

- [x] **Authentication**: SIWE-based wallet auth (iron-session v8)
- [x] **Database**: PostgreSQL via Prisma with 15 normalized models
- [x] **API Layer**: 13 typed endpoints with error handling + validation
- [x] **Input Validation**: Zod schemas on all mutation endpoints
- [x] **Rate Limiting**: In-memory rate limiter on all auth-required endpoints
- [x] **Structured Logging**: Pino with module-scoped child loggers
- [x] **Event Indexing**: viem WebSocket indexer for on-chain events
- [x] **Type Safety**: Zero TypeScript errors (`npx tsc --noEmit` passes)
- [x] **Dead Code Removed**: 10 engine files + 4 unused modules deleted
- [x] **No localStorage**: All persistence via PostgreSQL API calls
- [x] **No fake data**: All seeded/demo data generators removed
- [x] **Environment config**: .env.example with all required variables
- [ ] **PostgreSQL provisioned**: Need to set up a real database instance
- [ ] **Prisma migrations run**: `npx prisma migrate deploy` on production
- [ ] **Redis for rate limiting**: Optional but recommended for multi-instance
- [ ] **CI/CD pipeline**: Not yet configured
- [ ] **Error monitoring**: Sentry or similar not yet integrated
- [ ] **SSL/HTTPS**: Required for production cookies
- [ ] **CORS configuration**: Currently same-origin only (correct for monolith)
