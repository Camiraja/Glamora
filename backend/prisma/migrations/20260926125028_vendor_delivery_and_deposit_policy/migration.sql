-- CreateEnum
CREATE TYPE "BusinessDeliveryMode" AS ENUM ('STUDIO_ONLY', 'HOME_SERVICE_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "AppointmentDeliveryMode" AS ENUM ('STUDIO', 'HOME_SERVICE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "deliveryMode" "AppointmentDeliveryMode" NOT NULL DEFAULT 'STUDIO',
ADD COLUMN     "logisticsFeeKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vatKobo" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "breakagePercent" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "deliveryMode" "BusinessDeliveryMode" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "logisticsFeeKobo" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Business"
ADD CONSTRAINT "Business_breakagePercent_range_check"
CHECK ("breakagePercent" BETWEEN 20 AND 30),
ADD CONSTRAINT "Business_logisticsFeeKobo_nonnegative_check"
CHECK ("logisticsFeeKobo" >= 0);

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_upfront_amounts_nonnegative_check"
CHECK ("depositKobo" >= 0 AND "vatKobo" >= 0 AND "logisticsFeeKobo" >= 0);
