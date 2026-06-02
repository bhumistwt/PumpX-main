-- CreateTable
CREATE TABLE "NarrativeTrend" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "mentionGrowth" DOUBLE PRECISION NOT NULL,
    "sentiment" DOUBLE PRECISION NOT NULL,
    "trendDirection" VARCHAR(10) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrativeTrend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhaleAlert" (
    "id" TEXT NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "tokenAddress" VARCHAR(42) NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhaleAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMarketAnalysis" (
    "id" TEXT NOT NULL,
    "marketId" VARCHAR(42) NOT NULL,
    "bullCase" JSONB NOT NULL,
    "bearCase" JSONB NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "riskLevel" VARCHAR(10) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cachedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMarketAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeTrend_name_key" ON "NarrativeTrend"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WhaleAlert_txHash_key" ON "WhaleAlert"("txHash");

-- CreateIndex
CREATE INDEX "WhaleAlert_createdAt_idx" ON "WhaleAlert"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhaleAlert_walletAddress_idx" ON "WhaleAlert"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AiMarketAnalysis_marketId_key" ON "AiMarketAnalysis"("marketId");

-- CreateIndex
CREATE INDEX "AiMarketAnalysis_cachedUntil_idx" ON "AiMarketAnalysis"("cachedUntil");

-- AddForeignKey
ALTER TABLE "AiMarketAnalysis" ADD CONSTRAINT "AiMarketAnalysis_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("contractAddress") ON DELETE CASCADE ON UPDATE CASCADE;
