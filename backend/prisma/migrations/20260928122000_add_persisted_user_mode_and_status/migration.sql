ALTER TABLE "User"
ADD COLUMN "activeMode" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "User"
SET "activeMode" = "role"
WHERE "role" IN ('VENDOR', 'ADMIN');