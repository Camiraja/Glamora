CREATE TABLE "CustomerFavorite" (
    "customerId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFavorite_pkey" PRIMARY KEY ("customerId", "businessId")
);

CREATE INDEX "CustomerFavorite_businessId_idx" ON "CustomerFavorite"("businessId");

ALTER TABLE "CustomerFavorite" ADD CONSTRAINT "CustomerFavorite_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerFavorite" ADD CONSTRAINT "CustomerFavorite_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;