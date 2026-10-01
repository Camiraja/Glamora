ALTER TABLE "Wallet"
ADD COLUMN "mode" "UserRole" NOT NULL DEFAULT 'VENDOR';

DROP INDEX "Wallet_userId_key";

CREATE UNIQUE INDEX "Wallet_userId_mode_key" ON "Wallet"("userId", "mode");