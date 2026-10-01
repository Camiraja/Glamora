CREATE TYPE "ProductOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_FAILED', 'PROCESSING', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ProductOrderFulfillmentStatus" AS ENUM ('PROCESSING', 'DISPATCHED', 'COMPLETED');

CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ProductOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'INITIALIZED',
    "subtotalKobo" INTEGER NOT NULL,
    "discountKobo" INTEGER NOT NULL DEFAULT 0,
    "vatKobo" INTEGER NOT NULL DEFAULT 0,
    "shippingKobo" INTEGER NOT NULL DEFAULT 0,
    "totalKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "shippingName" TEXT NOT NULL,
    "shippingPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "inventoryReserved" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductOrder_amounts_check" CHECK ("subtotalKobo" >= 0 AND "discountKobo" >= 0 AND "vatKobo" >= 0 AND "shippingKobo" >= 0 AND "totalKobo" >= 0)
);

CREATE TABLE "ProductOrderFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "ProductOrderFulfillmentStatus" NOT NULL DEFAULT 'PROCESSING',
    "subtotalKobo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductOrderFulfillment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductOrderFulfillment_subtotal_check" CHECK ("subtotalKobo" >= 0)
);

CREATE TABLE "ProductOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "imageUrl" TEXT,
    "listPriceKobo" INTEGER NOT NULL,
    "unitPriceKobo" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductOrderItem_values_check" CHECK ("listPriceKobo" >= 0 AND "unitPriceKobo" >= 0 AND "discountPercent" BETWEEN 0 AND 100 AND "quantity" > 0)
);

ALTER TABLE "Payment" ADD COLUMN "orderId" TEXT;

CREATE INDEX "ProductOrder_customerId_createdAt_idx" ON "ProductOrder"("customerId", "createdAt");
CREATE INDEX "ProductOrder_status_expiresAt_idx" ON "ProductOrder"("status", "expiresAt");
CREATE UNIQUE INDEX "ProductOrderFulfillment_orderId_businessId_key" ON "ProductOrderFulfillment"("orderId", "businessId");
CREATE INDEX "ProductOrderFulfillment_vendorId_status_createdAt_idx" ON "ProductOrderFulfillment"("vendorId", "status", "createdAt");
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");
CREATE INDEX "ProductOrderItem_fulfillmentId_idx" ON "ProductOrderItem"("fulfillmentId");
CREATE INDEX "ProductOrderItem_productId_idx" ON "ProductOrderItem"("productId");
CREATE UNIQUE INDEX "Payment_orderId_type_key" ON "Payment"("orderId", "type");

ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderFulfillment" ADD CONSTRAINT "ProductOrderFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrderFulfillment" ADD CONSTRAINT "ProductOrderFulfillment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderFulfillment" ADD CONSTRAINT "ProductOrderFulfillment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "ProductOrderFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;