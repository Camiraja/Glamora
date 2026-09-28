/*
  Warnings:

  - A unique constraint covering the columns `[appointmentId,type]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Payment_appointmentId_type_key" ON "Payment"("appointmentId", "type");
