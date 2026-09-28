-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockoutDate" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_vendorId_dayOfWeek_idx" ON "Availability"("vendorId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "Availability_staffMemberId_dayOfWeek_idx" ON "Availability"("staffMemberId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BlockoutDate_vendorId_startsAt_endsAt_idx" ON "BlockoutDate"("vendorId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "BlockoutDate_staffMemberId_startsAt_endsAt_idx" ON "BlockoutDate"("staffMemberId", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockoutDate" ADD CONSTRAINT "BlockoutDate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockoutDate" ADD CONSTRAINT "BlockoutDate_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
