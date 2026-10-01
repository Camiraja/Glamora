ALTER TABLE "ConversationReport"
ADD COLUMN "appointmentId" TEXT;

CREATE INDEX "ConversationReport_appointmentId_idx"
ON "ConversationReport"("appointmentId");

ALTER TABLE "ConversationReport"
ADD CONSTRAINT "ConversationReport_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;