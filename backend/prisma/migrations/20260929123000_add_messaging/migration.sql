CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO');
CREATE TYPE "ChatMessageStatus" AS ENUM ('SENT', 'READ');
CREATE TYPE "ConversationReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED');

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderMode" "UserRole" NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "status" "ChatMessageStatus" NOT NULL DEFAULT 'SENT',
    "content" TEXT,
    "attachmentData" TEXT,
    "attachmentMimeType" TEXT,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChatMessage_attachment_check" CHECK (
      ("type" = 'TEXT' AND length(trim("content")) > 0 AND "attachmentData" IS NULL) OR
      ("type" IN ('IMAGE', 'AUDIO') AND "attachmentData" IS NOT NULL AND "attachmentMimeType" IS NOT NULL)
    ),
    CONSTRAINT "ChatMessage_duration_check" CHECK ("durationSeconds" IS NULL OR "durationSeconds" BETWEEN 1 AND 300)
);

CREATE TABLE "ConversationBlock" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConversationBlock_distinct_users_check" CHECK ("blockerId" <> "blockedUserId")
);

CREATE TABLE "ConversationReport" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "attachmentData" TEXT,
    "attachmentMimeType" TEXT,
    "status" "ConversationReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConversationReport_distinct_users_check" CHECK ("reporterId" <> "reportedUserId")
);

CREATE UNIQUE INDEX "Conversation_customerId_businessId_key" ON "Conversation"("customerId", "businessId");
CREATE INDEX "Conversation_customerId_lastMessageAt_idx" ON "Conversation"("customerId", "lastMessageAt");
CREATE INDEX "Conversation_vendorId_lastMessageAt_idx" ON "Conversation"("vendorId", "lastMessageAt");
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");
CREATE INDEX "ChatMessage_senderId_status_idx" ON "ChatMessage"("senderId", "status");
CREATE UNIQUE INDEX "ConversationBlock_conversationId_blockerId_key" ON "ConversationBlock"("conversationId", "blockerId");
CREATE INDEX "ConversationBlock_blockedUserId_idx" ON "ConversationBlock"("blockedUserId");
CREATE INDEX "ConversationReport_status_createdAt_idx" ON "ConversationReport"("status", "createdAt");
CREATE INDEX "ConversationReport_reporterId_createdAt_idx" ON "ConversationReport"("reporterId", "createdAt");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationBlock" ADD CONSTRAINT "ConversationBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;