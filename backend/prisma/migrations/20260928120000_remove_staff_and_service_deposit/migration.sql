ALTER TABLE "Availability" DROP CONSTRAINT "Availability_staffMemberId_fkey";
ALTER TABLE "BlockoutDate" DROP CONSTRAINT "BlockoutDate_staffMemberId_fkey";
ALTER TABLE "Service" DROP CONSTRAINT "Service_staffMemberId_fkey";
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_staffMemberId_fkey";
ALTER TABLE "AppointmentSlot" DROP CONSTRAINT "AppointmentSlot_staffMemberId_fkey";

DROP INDEX "Availability_staffMemberId_dayOfWeek_idx";
DROP INDEX "BlockoutDate_staffMemberId_startsAt_endsAt_idx";
DROP INDEX "Service_staffMemberId_idx";
DROP INDEX "StaffMember_businessId_idx";
DROP INDEX "StaffMember_userId_idx";
DROP INDEX "AppointmentSlot_staffMemberId_startsAt_key";

ALTER TABLE "Availability" DROP COLUMN "staffMemberId";
ALTER TABLE "BlockoutDate" DROP COLUMN "staffMemberId";
ALTER TABLE "Service" DROP COLUMN "staffMemberId", DROP COLUMN "depositPercent";
ALTER TABLE "Appointment" DROP COLUMN "staffMemberId";
ALTER TABLE "AppointmentService" DROP COLUMN "depositPercent";
ALTER TABLE "AppointmentSlot" DROP COLUMN "staffMemberId";

DROP TABLE "StaffMember";