-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "aiInsights" JSONB;
ALTER TABLE "UserProfile" ADD COLUMN IF NOT EXISTS "aiInsightsCachedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PumpScore" (
    "userAddress" VARCHAR(42) NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "participation" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "pumpScore" DOUBLE PRECISION NOT NULL,
    "totalMarkets" INTEGER NOT NULL DEFAULT 0,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "roiPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PumpScore_pkey" PRIMARY KEY ("userAddress")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PumpScore_pumpScore_idx" ON "PumpScore"("pumpScore" DESC);
CREATE INDEX IF NOT EXISTS "PumpScore_calculatedAt_idx" ON "PumpScore"("calculatedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PumpScore" ADD CONSTRAINT "PumpScore_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
