ALTER TYPE "PaymentType" ADD VALUE 'WALLET_TOP_UP';

CREATE TYPE "WalletTransactionType" AS ENUM (
  'CUSTOMER_TOP_UP',
  'APPOINTMENT_EARNING',
  'PRODUCT_EARNING',
  'WITHDRAWAL_HOLD',
  'WITHDRAWAL_RELEASE',
  'ORDER_PAYMENT',
  'APPOINTMENT_PAYMENT'
);

CREATE TYPE "WalletWithdrawalStatus" AS ENUM (
  'REQUESTED',
  'PROCESSING',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "Wallet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "balanceKobo" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Wallet_nonnegative_balance_check" CHECK ("balanceKobo" >= 0)
);

CREATE TABLE "WalletWithdrawal" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "amountKobo" INTEGER NOT NULL,
  "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletWithdrawal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletWithdrawal_positive_amount_check" CHECK ("amountKobo" > 0)
);

CREATE TABLE "WalletTransaction" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "WalletTransactionType" NOT NULL,
  "amountKobo" INTEGER NOT NULL,
  "balanceAfterKobo" INTEGER NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "paymentId" TEXT,
  "withdrawalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletTransaction_nonzero_amount_check" CHECK ("amountKobo" <> 0)
);

CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE INDEX "WalletWithdrawal_walletId_status_createdAt_idx" ON "WalletWithdrawal"("walletId", "status", "createdAt");
CREATE INDEX "WalletWithdrawal_status_createdAt_idx" ON "WalletWithdrawal"("status", "createdAt");
CREATE UNIQUE INDEX "WalletTransaction_sourceKey_key" ON "WalletTransaction"("sourceKey");
CREATE UNIQUE INDEX "WalletTransaction_paymentId_key" ON "WalletTransaction"("paymentId");
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");
CREATE INDEX "WalletTransaction_type_createdAt_idx" ON "WalletTransaction"("type", "createdAt");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletWithdrawal" ADD CONSTRAINT "WalletWithdrawal_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_withdrawalId_fkey"
  FOREIGN KEY ("withdrawalId") REFERENCES "WalletWithdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

WITH "earning_sources" AS (
  SELECT
    a."vendorId" AS "userId",
    p."id" AS "paymentId",
    p."amountKobo" AS "amountKobo",
    'APPOINTMENT_EARNING'::"WalletTransactionType" AS "type",
    'appointment-payment:' || p."id" AS "sourceKey",
    'Completed appointment payment' AS "description",
    p."paidAt" AS "createdAt"
  FROM "Appointment" a
  JOIN "Payment" p ON p."appointmentId" = a."id"
  WHERE a."status" = 'COMPLETED'
    AND p."status" = 'SUCCESSFUL'
    AND p."type" IN ('DEPOSIT', 'BALANCE')
    AND p."amountKobo" > 0

  UNION ALL

  SELECT
    f."vendorId" AS "userId",
    NULL::TEXT AS "paymentId",
    f."subtotalKobo" AS "amountKobo",
    'PRODUCT_EARNING'::"WalletTransactionType" AS "type",
    'product-fulfillment:' || f."id" AS "sourceKey",
    'Completed paid product fulfillment' AS "description",
    f."updatedAt" AS "createdAt"
  FROM "ProductOrderFulfillment" f
  JOIN "ProductOrder" o ON o."id" = f."orderId"
  WHERE f."status" = 'COMPLETED'
    AND o."paymentStatus" = 'SUCCESSFUL'
    AND f."subtotalKobo" > 0
), "wallet_totals" AS (
  SELECT "userId", SUM("amountKobo")::INTEGER AS "balanceKobo", MIN("createdAt") AS "createdAt", MAX("createdAt") AS "updatedAt"
  FROM "earning_sources"
  GROUP BY "userId"
), "inserted_wallets" AS (
  INSERT INTO "Wallet" ("id", "userId", "balanceKobo", "currency", "createdAt", "updatedAt")
  SELECT md5('wallet:' || "userId"), "userId", "balanceKobo", 'NGN', "createdAt", "updatedAt"
  FROM "wallet_totals"
  RETURNING "id", "userId"
)
INSERT INTO "WalletTransaction" (
  "id", "walletId", "type", "amountKobo", "balanceAfterKobo", "sourceKey", "description", "paymentId", "createdAt"
)
SELECT
  md5('wallet-transaction:' || e."sourceKey"),
  w."id",
  e."type",
  e."amountKobo",
  SUM(e."amountKobo") OVER (PARTITION BY e."userId" ORDER BY e."createdAt", e."sourceKey" ROWS UNBOUNDED PRECEDING)::INTEGER,
  e."sourceKey",
  e."description",
  e."paymentId",
  e."createdAt"
FROM "earning_sources" e
JOIN "inserted_wallets" w ON w."userId" = e."userId";
