-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" VARCHAR(64) NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "address" VARCHAR(42) NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "avatarUrl" VARCHAR(500),
    "bio" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("address")
);

-- CreateIndex
CREATE INDEX "AuthNonce_address_idx" ON "AuthNonce"("address");

-- CreateIndex
CREATE INDEX "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_address_fkey" FOREIGN KEY ("address") REFERENCES "User"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
