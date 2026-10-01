CREATE TYPE "AuthCredentialPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;

CREATE TABLE "AuthCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthCredentialPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthCredential_userId_purpose_expiresAt_idx" ON "AuthCredential"("userId", "purpose", "expiresAt");

ALTER TABLE "AuthCredential" ADD CONSTRAINT "AuthCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;