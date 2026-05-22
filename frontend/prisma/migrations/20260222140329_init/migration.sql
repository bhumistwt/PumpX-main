-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ORACLE', 'ADMIN');

-- CreateEnum
CREATE TYPE "BetSide" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "ReputationType" AS ENUM ('UPVOTE', 'FLAG');

-- CreateEnum
CREATE TYPE "SquadRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('PENDING', 'ACTIVE', 'SETTLED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "address" VARCHAR(42) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "contractAddress" VARCHAR(42) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "creatorAddress" VARCHAR(42) NOT NULL,
    "tokenAddress" VARCHAR(42) NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "threshold" TEXT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "initialSupply" TEXT NOT NULL,
    "latestSupply" TEXT NOT NULL,
    "yesPool" TEXT NOT NULL DEFAULT '0',
    "noPool" TEXT NOT NULL DEFAULT '0',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "reached" BOOLEAN NOT NULL DEFAULT false,
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "txHash" VARCHAR(66) NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "stockTicker" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "marketAddress" VARCHAR(42) NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "side" "BetSide" NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "marketAddress" VARCHAR(42) NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "payout" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPTransaction" (
    "id" TEXT NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "seasonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "userAddress" VARCHAR(42) NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" VARCHAR(10) NOT NULL,
    "shieldsRemaining" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userAddress")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "badgeId" VARCHAR(50) NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reputation" (
    "userAddress" VARCHAR(42) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "marketsCreated" INTEGER NOT NULL DEFAULT 0,
    "marketsResolved" INTEGER NOT NULL DEFAULT 0,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" TEXT NOT NULL DEFAULT '0',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "flags" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("userAddress")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "fromAddress" VARCHAR(42) NOT NULL,
    "toAddress" VARCHAR(42) NOT NULL,
    "type" "ReputationType" NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonEntry" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,

    CONSTRAINT "SeasonEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "tag" VARCHAR(5) NOT NULL,
    "inviteCode" VARCHAR(12) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "role" "SquadRole" NOT NULL DEFAULT 'MEMBER',
    "xpContributed" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "creatorAddress" VARCHAR(42) NOT NULL,
    "challengerAddress" VARCHAR(42),
    "marketAddress" VARCHAR(42) NOT NULL,
    "creatorSide" "BetSide" NOT NULL,
    "stakeXP" INTEGER NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'PENDING',
    "winnnerAddress" VARCHAR(42),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "chainId" INTEGER NOT NULL,
    "lastBlockNumber" INTEGER NOT NULL DEFAULT 0,
    "lastBlockHash" VARCHAR(66) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "ChallengeProgress" (
    "id" TEXT NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "challengeId" VARCHAR(50) NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "xpAwarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Market_contractAddress_key" ON "Market"("contractAddress");

-- CreateIndex
CREATE INDEX "Market_creatorAddress_idx" ON "Market"("creatorAddress");

-- CreateIndex
CREATE INDEX "Market_chainId_idx" ON "Market"("chainId");

-- CreateIndex
CREATE INDEX "Market_resolved_idx" ON "Market"("resolved");

-- CreateIndex
CREATE INDEX "Market_deadline_idx" ON "Market"("deadline");

-- CreateIndex
CREATE INDEX "Market_stockTicker_idx" ON "Market"("stockTicker");

-- CreateIndex
CREATE INDEX "Market_createdAt_idx" ON "Market"("createdAt");

-- CreateIndex
CREATE INDEX "Bet_marketAddress_idx" ON "Bet"("marketAddress");

-- CreateIndex
CREATE INDEX "Bet_userAddress_idx" ON "Bet"("userAddress");

-- CreateIndex
CREATE INDEX "Bet_createdAt_idx" ON "Bet"("createdAt");

-- CreateIndex
CREATE INDEX "Bet_chainId_idx" ON "Bet"("chainId");

-- CreateIndex
CREATE INDEX "Claim_userAddress_idx" ON "Claim"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_marketAddress_userAddress_key" ON "Claim"("marketAddress", "userAddress");

-- CreateIndex
CREATE INDEX "XPTransaction_userAddress_idx" ON "XPTransaction"("userAddress");

-- CreateIndex
CREATE INDEX "XPTransaction_createdAt_idx" ON "XPTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "XPTransaction_seasonId_idx" ON "XPTransaction"("seasonId");

-- CreateIndex
CREATE INDEX "UserBadge_userAddress_idx" ON "UserBadge"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userAddress_badgeId_key" ON "UserBadge"("userAddress", "badgeId");

-- CreateIndex
CREATE INDEX "ReputationEvent_toAddress_idx" ON "ReputationEvent"("toAddress");

-- CreateIndex
CREATE INDEX "ReputationEvent_fromAddress_idx" ON "ReputationEvent"("fromAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "Season_active_idx" ON "Season"("active");

-- CreateIndex
CREATE INDEX "SeasonEntry_seasonId_xp_idx" ON "SeasonEntry"("seasonId", "xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonEntry_seasonId_userAddress_key" ON "SeasonEntry"("seasonId", "userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_name_key" ON "Squad"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_tag_key" ON "Squad"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Squad_inviteCode_key" ON "Squad"("inviteCode");

-- CreateIndex
CREATE INDEX "Squad_totalXP_idx" ON "Squad"("totalXP" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SquadMember_userAddress_key" ON "SquadMember"("userAddress");

-- CreateIndex
CREATE INDEX "SquadMember_squadId_idx" ON "SquadMember"("squadId");

-- CreateIndex
CREATE INDEX "Battle_creatorAddress_idx" ON "Battle"("creatorAddress");

-- CreateIndex
CREATE INDEX "Battle_challengerAddress_idx" ON "Battle"("challengerAddress");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "Battle_marketAddress_idx" ON "Battle"("marketAddress");

-- CreateIndex
CREATE INDEX "ChallengeProgress_userAddress_date_idx" ON "ChallengeProgress"("userAddress", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeProgress_userAddress_challengeId_date_key" ON "ChallengeProgress"("userAddress", "challengeId", "date");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_creatorAddress_fkey" FOREIGN KEY ("creatorAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketAddress_fkey" FOREIGN KEY ("marketAddress") REFERENCES "Market"("contractAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTransaction" ADD CONSTRAINT "XPTransaction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_fromAddress_fkey" FOREIGN KEY ("fromAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_toAddress_fkey" FOREIGN KEY ("toAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonEntry" ADD CONSTRAINT "SeasonEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonEntry" ADD CONSTRAINT "SeasonEntry_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMember" ADD CONSTRAINT "SquadMember_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_creatorAddress_fkey" FOREIGN KEY ("creatorAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_challengerAddress_fkey" FOREIGN KEY ("challengerAddress") REFERENCES "User"("address") ON DELETE SET NULL ON UPDATE CASCADE;
