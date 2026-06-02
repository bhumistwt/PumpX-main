-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "marketId" VARCHAR(42) NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" VARCHAR(42) NOT NULL,
    "refereeId" VARCHAR(42) NOT NULL,
    "marketId" VARCHAR(42) NOT NULL,
    "volumeGenerated" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_marketId_createdAt_idx" ON "Comment"("marketId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_walletAddress_idx" ON "Comment"("walletAddress");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_refereeId_idx" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_marketId_idx" ON "Referral"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrerId_refereeId_marketId_key" ON "Referral"("referrerId", "refereeId", "marketId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("contractAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("contractAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
