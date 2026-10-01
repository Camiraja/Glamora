import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { body, validationResult } from "express-validator";
import prisma from "./lib/prisma.js";
import { authCodeMatches, createAuthCode, hashAuthCode } from "./lib/auth-credentials.js";
import { createAuthRateLimiter } from "./middleware/auth-rate-limit.js";
import { requireAuth } from "./middleware/auth.js";
import { isEmailDeliveryConfigured, sendEmail } from "./services/email.js";

const app = express();
const serviceImageMaxBytes = 5 * 1024 * 1024;
const serviceImageMaxDataUriLength = Math.ceil(serviceImageMaxBytes / 3) * 4 + 32;
const authCredentialLifetimeMs = 15 * 60 * 1000;
const authCredentialMaxAttempts = 5;
const authRequestLimiter = createAuthRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const authCodeLimiter = createAuthRateLimiter({ limit: 20, windowMs: 15 * 60 * 1000 });

function hasAuthCredentialPepper() {
  const pepper = process.env.AUTH_CREDENTIAL_PEPPER || process.env.JWT_SECRET;
  return Boolean(pepper && pepper.length >= 32);
}

function authEmailReady() {
  return hasAuthCredentialPepper() && isEmailDeliveryConfigured();
}

async function issueAuthEmailCode(user, purpose) {
  const code = createAuthCode();
  const now = new Date();
  const tokenHash = hashAuthCode(code);
  await prisma.$transaction(async (transaction) => {
    await transaction.authCredential.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: now },
    });
    await transaction.authCredential.create({
      data: {
        userId: user.id,
        purpose,
        tokenHash,
        expiresAt: new Date(now.getTime() + authCredentialLifetimeMs),
      },
    });
  });

  try {
    const isVerification = purpose === "EMAIL_VERIFICATION";
    await sendEmail({
      to: user.email,
      subject: isVerification ? "Verify your Glamora email" : "Reset your Glamora password",
      text: `Your Glamora ${isVerification ? "email verification" : "password recovery"} code is ${code}. It expires in 15 minutes and can only be used once.`,
    });
  } catch (error) {
    await prisma.authCredential.updateMany({
      where: { userId: user.id, purpose, tokenHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    throw error;
  }
}

async function findAuthEmailCode(email, purpose, code) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const credential = await prisma.authCredential.findFirst({
    where: {
      userId: user.id,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      failedAttempts: { lt: authCredentialMaxAttempts },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!credential) return null;

  if (!authCodeMatches(code, credential.tokenHash)) {
    await prisma.authCredential.updateMany({
      where: {
        id: credential.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        failedAttempts: { lt: authCredentialMaxAttempts },
      },
      data: { failedAttempts: { increment: 1 } },
    });
    return null;
  }
  return { user, credential };
}

function genericAuthCodeError(response) {
  return response.status(400).json({ message: "The code is invalid or expired." });
}

function isValidServiceImageReference(value) {
  if (typeof value !== "string" || !value) return false;
  if (value.length > serviceImageMaxDataUriLength) return false;
  if (value.length <= 2048) {
    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol) && url.hostname) return true;
    } catch {}
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return false;
  const imageBytes = Buffer.from(match[2], "base64");
  if (imageBytes.length === 0 || imageBytes.length > serviceImageMaxBytes || imageBytes.toString("base64") !== match[2]) return false;

  const mimeType = match[1].toLowerCase();
  const isPng = imageBytes.length >= 8 && imageBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = imageBytes.length >= 3 && imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff;
  const isWebp = imageBytes.length >= 12 && imageBytes.toString("ascii", 0, 4) === "RIFF" && imageBytes.toString("ascii", 8, 12) === "WEBP";
  return (mimeType === "image/png" && isPng) || (mimeType === "image/jpeg" && isJpeg) || (mimeType === "image/webp" && isWebp);
}

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
const vatRatePercent = Number(process.env.VAT_RATE_PERCENT ?? 0);
const lagosTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const weekdayNumbers = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getLagosDayAndMinutes(date) {
  const parts = Object.fromEntries(
    lagosTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    dayOfWeek: weekdayNumbers[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

async function releaseProductOrderInventory(transaction, orderId) {
  const released = await transaction.productOrder.updateMany({
    where: {
      id: orderId,
      inventoryReserved: true,
      status: "PENDING_PAYMENT",
      paymentStatus: { in: ["INITIALIZED", "PENDING"] },
    },
    data: { inventoryReserved: false, status: "PAYMENT_FAILED", paymentStatus: "FAILED" },
  });
  if (released.count !== 1) return false;
  const items = await transaction.productOrderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.productId) {
      await transaction.product.updateMany({
        where: { id: item.productId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  }
  return true;
}

async function updateProductOrderStatus(transaction, orderId) {
  const fulfillments = await transaction.productOrderFulfillment.findMany({
    where: { orderId },
    select: { status: true },
  });
  const completedCount = fulfillments.filter((fulfillment) => fulfillment.status === "COMPLETED").length;
  const dispatchedCount = fulfillments.filter((fulfillment) => fulfillment.status === "DISPATCHED").length;
  const status = completedCount === fulfillments.length
    ? "COMPLETED"
    : completedCount + dispatchedCount === fulfillments.length
      ? "DISPATCHED"
      : completedCount + dispatchedCount > 0
        ? "PARTIALLY_DISPATCHED"
        : "PROCESSING";
  await transaction.productOrder.update({ where: { id: orderId }, data: { status } });
}

async function ensureWallet(transaction, userId, mode) {
  return transaction.wallet.upsert({
    where: { userId_mode: { userId, mode } },
    update: {},
    create: { userId, mode },
  });
}

async function postWalletTransaction(transaction, {
  userId,
  mode,
  type,
  amountKobo,
  sourceKey,
  description,
  paymentId = null,
  withdrawalId = null,
}) {
  if (!Number.isInteger(amountKobo) || amountKobo === 0) throw new Error("WALLET_INVALID_AMOUNT");
  const existing = await transaction.walletTransaction.findUnique({ where: { sourceKey } });
  if (existing) return existing;
  const wallet = await ensureWallet(transaction, userId, mode);
  const updated = await transaction.wallet.updateMany({
    where: {
      id: wallet.id,
      ...(amountKobo < 0 ? { balanceKobo: { gte: -amountKobo } } : {}),
    },
    data: { balanceKobo: { increment: amountKobo } },
  });
  if (updated.count !== 1) throw new Error("WALLET_INSUFFICIENT_BALANCE");
  const balance = await transaction.wallet.findUnique({ where: { id: wallet.id }, select: { balanceKobo: true } });
  return transaction.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type,
      amountKobo,
      balanceAfterKobo: balance.balanceKobo,
      sourceKey,
      description,
      paymentId,
      withdrawalId,
    },
  });
}

async function settleWalletTopUp(paymentId, paidAt) {
  return prisma.$transaction(async (transaction) => {
    const payment = await transaction.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.type !== "WALLET_TOP_UP") return false;
    const sourceKey = `payment:${payment.id}`;
    const changed = await transaction.payment.updateMany({
      where: { id: payment.id, status: { in: ["INITIALIZED", "PENDING"] } },
      data: { status: "SUCCESSFUL", paidAt: paidAt || new Date() },
    });
    if (changed.count !== 1) {
      return Boolean(await transaction.walletTransaction.findUnique({ where: { sourceKey } }));
    }
    await postWalletTransaction(transaction, {
      userId: payment.userId,
      mode: "CUSTOMER",
      type: "CUSTOMER_TOP_UP",
      amountKobo: payment.amountKobo,
      sourceKey,
      description: "Wallet top-up via Paystack",
      paymentId: payment.id,
    });
    return true;
  });
}

const analyticsRangeNames = ["24h", "7d", "30d", "90d", "thisMonth", "lastMonth", "yearToDate"];

function resolveAnalyticsRange(name) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (name === "24h") {
    return { startAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), endAt: now, interval: "hour" };
  }
  if (name === "7d" || name === "30d" || name === "90d") {
    const days = Number.parseInt(name, 10);
    return { startAt: new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000), endAt: new Date(today.getTime() + 24 * 60 * 60 * 1000), interval: "day" };
  }
  if (name === "thisMonth") {
    return { startAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), endAt: new Date(today.getTime() + 24 * 60 * 60 * 1000), interval: "day" };
  }
  if (name === "lastMonth") {
    return { startAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), endAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), interval: "day" };
  }
  if (name === "yearToDate") {
    return { startAt: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), endAt: new Date(today.getTime() + 24 * 60 * 60 * 1000), interval: "month" };
  }
  return null;
}

function getAnalyticsBucketKey(date, interval) {
  const iso = date.toISOString();
  return interval === "hour" ? iso.slice(0, 13) : interval === "month" ? iso.slice(0, 7) : iso.slice(0, 10);
}

function createAnalyticsSeries(range) {
  const cursor = new Date(range.startAt);
  if (range.interval === "hour") cursor.setUTCMinutes(0, 0, 0);
  else if (range.interval === "day") cursor.setUTCHours(0, 0, 0, 0);
  else cursor.setUTCDate(1), cursor.setUTCHours(0, 0, 0, 0);

  const series = [];
  while (cursor < range.endAt && series.length < 400) {
    const key = getAnalyticsBucketKey(cursor, range.interval);
    const label = range.interval === "hour"
      ? cursor.toLocaleString("en-NG", { month: "short", day: "numeric", hour: "numeric", timeZone: "UTC" })
      : range.interval === "month"
        ? cursor.toLocaleString("en-NG", { month: "short", timeZone: "UTC" })
        : cursor.toLocaleString("en-NG", { month: "short", day: "numeric", timeZone: "UTC" });
    series.push({ key, label, bookings: 0, revenueKobo: 0 });
    if (range.interval === "hour") cursor.setUTCHours(cursor.getUTCHours() + 1);
    else if (range.interval === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return series;
}

async function releaseExpiredProductOrders() {
  const expired = await prisma.productOrder.findMany({
    where: { status: "PENDING_PAYMENT", inventoryReserved: true, expiresAt: { lte: new Date() } },
    include: { payments: { where: { type: "PRODUCT_ORDER" } } },
    take: 100,
  });
  for (const order of expired) {
    const payment = order.payments[0];
    if (payment?.status === "PENDING" && payment.paystackReference && process.env.PAYSTACK_SECRET_KEY) {
      try {
        const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.paystackReference)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        });
        const verification = await verifyResponse.json();
        const transactionData = verification.data;
        if (!verifyResponse.ok || !verification.status || !transactionData) continue;
        if (transactionData.status === "success") {
          if (transactionData.amount !== payment.amountKobo || transactionData.currency !== "NGN" || transactionData.metadata?.orderId !== order.id) continue;
          await prisma.$transaction(async (transaction) => {
            const settled = await transaction.productOrder.updateMany({
              where: { id: order.id, status: "PENDING_PAYMENT", paymentStatus: "PENDING", inventoryReserved: true },
              data: { status: "PROCESSING", paymentStatus: "SUCCESSFUL" },
            });
            if (settled.count === 1) {
              await transaction.payment.update({ where: { id: payment.id }, data: { status: "SUCCESSFUL", paidAt: payment.paidAt || new Date() } });
            }
          });
          continue;
        }
        if (!["failed", "abandoned"].includes(transactionData.status)) continue;
      } catch {
        continue;
      }
    } else if (payment?.status === "PENDING") {
      continue;
    }
    await prisma.$transaction(async (transaction) => {
      await releaseProductOrderInventory(transaction, order.id);
      await transaction.payment.updateMany({
        where: { orderId: order.id, type: "PRODUCT_ORDER", status: { in: ["INITIALIZED", "PENDING"] } },
        data: { status: "FAILED" },
      });
    });
  }
}

if (!Number.isFinite(vatRatePercent) || vatRatePercent < 0 || vatRatePercent > 100) {
  throw new Error("VAT_RATE_PERCENT must be a number between 0 and 100.");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({
  limit: "10mb",
  verify(request, response, buffer) {
    request.rawBody = Buffer.from(buffer);
  },
}));

function requireVendor(request, response, next) {
  if (request.user.role !== "VENDOR" || request.user.activeMode !== "VENDOR") {
    return response.status(403).json({ message: "Vendor access is required." });
  }
  return next();
}

function requireCustomerMode(request, response, next) {
  if (!["CUSTOMER", "VENDOR"].includes(request.user.role) || request.user.activeMode !== "CUSTOMER") {
    return response.status(403).json({ message: "Customer mode is required." });
  }
  return next();
}

function requireCustomerOrVendorMode(request, response, next) {
  if (!["CUSTOMER", "VENDOR"].includes(request.user.role)) {
    return response.status(403).json({ message: "Customer or vendor access is required." });
  }
  return next();
}

function requireAdmin(request, response, next) {
  if (request.user.role !== "ADMIN" || request.user.activeMode !== "ADMIN") {
    return response.status(403).json({ message: "Admin access is required." });
  }
  return next();
}

async function findConversationForActiveUser(conversationId, user) {
  if (user.activeMode === "CUSTOMER" && ["CUSTOMER", "VENDOR"].includes(user.role)) {
    return prisma.conversation.findFirst({ where: { id: conversationId, customerId: user.sub } });
  }
  if (user.role === "VENDOR" && user.activeMode === "VENDOR") {
    return prisma.conversation.findFirst({
      where: { id: conversationId, vendorId: user.sub, business: { ownerId: user.sub } },
    });
  }
  return null;
}

async function getOrCreateConversation(customerId, business) {
  return prisma.conversation.upsert({
    where: { customerId_businessId: { customerId, businessId: business.id } },
    update: { vendorId: business.ownerId },
    create: { customerId, vendorId: business.ownerId, businessId: business.id },
    include: {
      business: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
    },
  });
}

async function findAppointmentForTrustSafety(appointmentId, user) {
  if (user.activeMode === "CUSTOMER" && ["CUSTOMER", "VENDOR"].includes(user.role)) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, customerId: user.sub },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    });
    return appointment?.business.ownerId !== user.sub ? appointment : null;
  }
  if (user.role === "VENDOR" && user.activeMode === "VENDOR") {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, vendorId: user.sub, business: { ownerId: user.sub } },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    });
    return appointment?.customerId !== user.sub ? appointment : null;
  }
  return null;
}

app.get("/api/conversations", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const where = request.user.activeMode === "VENDOR"
    ? { vendorId: request.user.sub, business: { ownerId: request.user.sub } }
    : { customerId: request.user.sub };
  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      business: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, senderId: true, type: true, content: true, createdAt: true } },
      blocks: { where: { OR: [{ blockerId: request.user.sub }, { blockedUserId: request.user.sub }] }, select: { blockerId: true, blockedUserId: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  const withUnread = await Promise.all(conversations.map(async (conversation) => ({
    ...conversation,
    hasBooking: (await prisma.appointment.count({ where: { customerId: conversation.customerId, businessId: conversation.businessId } })) > 0,
    unreadCount: await prisma.chatMessage.count({
      where: { conversationId: conversation.id, senderId: { not: request.user.sub }, status: "SENT" },
    }),
  })));
  return response.json({ conversations: withUnread });
});

app.post(
  "/api/conversations",
  requireAuth,
  requireCustomerMode,
  [body("businessId").isUUID()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Choose a valid business to message.", errors: errors.array() });
    const business = await prisma.business.findFirst({
      where: { id: request.body.businessId, isActive: true, owner: { isActive: true, role: "VENDOR" } },
      select: { id: true, name: true, ownerId: true },
    });
    if (!business) return response.status(404).json({ message: "Business was not found." });
    if (business.ownerId === request.user.sub) return response.status(403).json({ message: "You cannot start a conversation with your own business." });
    const conversation = await getOrCreateConversation(request.user.sub, business);
    return response.status(200).json({ conversation });
  },
);

app.post(
  "/api/conversations/from-appointment",
  requireAuth,
  requireVendor,
  [body("appointmentId").isUUID()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A valid appointment is required.", errors: errors.array() });
    const appointment = await prisma.appointment.findFirst({
      where: { id: request.body.appointmentId, vendorId: request.user.sub },
      include: { business: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!appointment) return response.status(404).json({ message: "Appointment was not found for this vendor." });
    const conversation = await getOrCreateConversation(appointment.customerId, appointment.business);
    return response.json({ conversation });
  },
);

app.get("/api/conversations/:conversationId/messages", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const conversation = await findConversationForActiveUser(request.params.conversationId, request.user);
  if (!conversation) return response.status(404).json({ message: "Conversation was not found." });
  const blocks = await prisma.conversationBlock.findMany({
    where: { conversationId: conversation.id },
    select: { blockerId: true, blockedUserId: true },
  });
  const blockedByMe = blocks.some((block) => block.blockerId === request.user.sub);
  const blockedMe = blocks.some((block) => block.blockedUserId === request.user.sub);
  await prisma.chatMessage.updateMany({
    where: { conversationId: conversation.id, senderId: { not: request.user.sub }, status: "SENT" },
    data: { status: "READ", readAt: new Date() },
  });
  const messages = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return response.json({ messages, blockedByMe, blockedMe });
});

app.post(
  "/api/conversations/:conversationId/messages",
  requireAuth,
  requireCustomerOrVendorMode,
  [
    body("type").isIn(["TEXT", "IMAGE", "AUDIO"]),
    body("content").optional().isString().trim().isLength({ max: 4000 }),
    body("attachmentData").optional().isString().isLength({ max: 8_500_000 }),
    body("attachmentMimeType").optional().isString().isLength({ max: 100 }),
    body("durationSeconds").optional().isInt({ min: 1, max: 300 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Message content is invalid.", errors: errors.array() });
    const conversation = await findConversationForActiveUser(request.params.conversationId, request.user);
    if (!conversation) return response.status(404).json({ message: "Conversation was not found." });
    const blocked = await prisma.conversationBlock.findFirst({
      where: { conversationId: conversation.id, OR: [{ blockerId: request.user.sub }, { blockedUserId: request.user.sub }] },
    });
    if (blocked) return response.status(403).json({ message: "Messaging is blocked in this conversation." });

    const type = request.body.type;
    const content = request.body.content?.trim() || null;
    const attachmentData = request.body.attachmentData || null;
    const attachmentMimeType = request.body.attachmentMimeType || null;
    if (type === "TEXT" && (!content || attachmentData)) return response.status(400).json({ message: "Text messages require text content only." });
    if (type === "IMAGE" && (!attachmentData || !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(attachmentData) || !/^image\/(png|jpeg|webp|gif)$/i.test(attachmentMimeType || ""))) {
      return response.status(400).json({ message: "Image messages require a supported image attachment." });
    }
    if (type === "AUDIO" && (!attachmentData || !/^data:audio\/(webm|ogg|mp4|mpeg)(?:;codecs=[a-z0-9,._-]+)?;base64,/i.test(attachmentData) || !/^audio\/(webm|ogg|mp4|mpeg)(?:;codecs=[a-z0-9,._-]+)?$/i.test(attachmentMimeType || ""))) {
      return response.status(400).json({ message: "Audio messages require a supported audio attachment." });
    }

    const message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.chatMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: request.user.sub,
          senderMode: request.user.activeMode,
          type,
          content,
          attachmentData,
          attachmentMimeType,
          durationSeconds: request.body.durationSeconds ? Number(request.body.durationSeconds) : null,
        },
        include: { sender: { select: { id: true, name: true } } },
      });
      await transaction.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.createdAt } });
      return created;
    });
    return response.status(201).json({ message });
  },
);

app.post("/api/conversations/:conversationId/block", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const conversation = await findConversationForActiveUser(request.params.conversationId, request.user);
  if (!conversation) return response.status(404).json({ message: "Conversation was not found." });
  const blockedUserId = conversation.customerId === request.user.sub ? conversation.vendorId : conversation.customerId;
  const block = await prisma.conversationBlock.upsert({
    where: { conversationId_blockerId: { conversationId: conversation.id, blockerId: request.user.sub } },
    update: { blockedUserId },
    create: { conversationId: conversation.id, blockerId: request.user.sub, blockedUserId },
  });
  return response.json({ message: "User blocked for this conversation.", block });
});

app.delete("/api/conversations/:conversationId/block", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const conversation = await findConversationForActiveUser(request.params.conversationId, request.user);
  if (!conversation) return response.status(404).json({ message: "Conversation was not found." });
  await prisma.conversationBlock.deleteMany({ where: { conversationId: conversation.id, blockerId: request.user.sub } });
  return response.json({ message: "User unblocked." });
});

app.post(
  "/api/conversations/:conversationId/reports",
  requireAuth,
  requireCustomerOrVendorMode,
  [
    body("reason").isIn(["HARASSMENT", "SPAM_FRAUD", "UNSAFE_PAYMENT", "OTHER"]),
    body("details").trim().isLength({ min: 10, max: 2000 }),
    body("alsoBlock").optional().isBoolean(),
    body("attachmentData").optional().isString().isLength({ max: 8_500_000 }),
    body("attachmentMimeType").optional().isIn(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Report details are invalid.", errors: errors.array() });
    const conversation = await findConversationForActiveUser(request.params.conversationId, request.user);
    if (!conversation) return response.status(404).json({ message: "Conversation was not found." });
    const reportedUserId = conversation.customerId === request.user.sub ? conversation.vendorId : conversation.customerId;
    if (request.body.attachmentData && !new RegExp(`^data:${request.body.attachmentMimeType};base64,`, "i").test(request.body.attachmentData)) {
      return response.status(400).json({ message: "Report attachment data does not match its image type." });
    }
    const report = await prisma.conversationReport.create({
      data: {
        conversationId: conversation.id,
        reporterId: request.user.sub,
        reportedUserId,
        reason: request.body.reason,
        details: request.body.details.trim(),
        attachmentData: request.body.attachmentData || null,
        attachmentMimeType: request.body.attachmentMimeType || null,
      },
    });
    if (request.body.alsoBlock === true) {
      await prisma.conversationBlock.upsert({
        where: { conversationId_blockerId: { conversationId: conversation.id, blockerId: request.user.sub } },
        update: { blockedUserId: reportedUserId },
        create: { conversationId: conversation.id, blockerId: request.user.sub, blockedUserId: reportedUserId },
      });
    }
    return response.status(201).json({ message: "Report submitted.", report });
  },
);

app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    message: "Glamora backend is running",
  });
});

app.post("/api/appointments/:appointmentId/block", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const appointment = await findAppointmentForTrustSafety(request.params.appointmentId, request.user);
  if (!appointment) return response.status(404).json({ message: "Appointment was not found." });
  const conversation = await getOrCreateConversation(appointment.customerId, appointment.business);
  const blockedUserId = appointment.customerId === request.user.sub ? appointment.vendorId : appointment.customerId;
  const block = await prisma.conversationBlock.upsert({
    where: { conversationId_blockerId: { conversationId: conversation.id, blockerId: request.user.sub } },
    update: { blockedUserId },
    create: { conversationId: conversation.id, blockerId: request.user.sub, blockedUserId },
  });
  return response.json({ message: "User blocked for this appointment conversation.", block });
});

app.delete("/api/appointments/:appointmentId/block", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const appointment = await findAppointmentForTrustSafety(request.params.appointmentId, request.user);
  if (!appointment) return response.status(404).json({ message: "Appointment was not found." });
  const conversation = await getOrCreateConversation(appointment.customerId, appointment.business);
  await prisma.conversationBlock.deleteMany({ where: { conversationId: conversation.id, blockerId: request.user.sub } });
  return response.json({ message: "User unblocked." });
});

app.post(
  "/api/appointments/:appointmentId/reports",
  requireAuth,
  requireCustomerOrVendorMode,
  [
    body("reason").isIn(["HARASSMENT", "SPAM_FRAUD", "UNSAFE_PAYMENT", "OTHER"]),
    body("details").trim().isLength({ min: 10, max: 2000 }),
    body("alsoBlock").optional().isBoolean(),
    body("attachmentData").optional().isString().isLength({ max: 8_500_000 }),
    body("attachmentMimeType").optional().isIn(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Report details are invalid.", errors: errors.array() });
    const appointment = await findAppointmentForTrustSafety(request.params.appointmentId, request.user);
    if (!appointment) return response.status(404).json({ message: "Appointment was not found." });
    if (request.body.attachmentData && !new RegExp(`^data:${request.body.attachmentMimeType};base64,`, "i").test(request.body.attachmentData)) {
      return response.status(400).json({ message: "Report attachment data does not match its image type." });
    }
    const conversation = await getOrCreateConversation(appointment.customerId, appointment.business);
    const reportedUserId = appointment.customerId === request.user.sub ? appointment.vendorId : appointment.customerId;
    const report = await prisma.$transaction(async (transaction) => {
      const created = await transaction.conversationReport.create({
        data: {
          conversationId: conversation.id,
          appointmentId: appointment.id,
          reporterId: request.user.sub,
          reportedUserId,
          reason: request.body.reason,
          details: request.body.details.trim(),
          attachmentData: request.body.attachmentData || null,
          attachmentMimeType: request.body.attachmentMimeType || null,
        },
      });
      if (request.body.alsoBlock === true) {
        await transaction.conversationBlock.upsert({
          where: { conversationId_blockerId: { conversationId: conversation.id, blockerId: request.user.sub } },
          update: { blockedUserId: reportedUserId },
          create: { conversationId: conversation.id, blockerId: request.user.sub, blockedUserId: reportedUserId },
        });
      }
      return created;
    });
    return response.status(201).json({ message: "Report submitted.", report });
  },
);

app.post("/api/payments/paystack/webhook", async (request, response) => {
  const signature = request.get("x-paystack-signature");
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature || !request.rawBody) {
    return response.status(401).json({ message: "A valid Paystack webhook signature is required." });
  }

  const expectedSignature = createHmac("sha512", secret).update(request.rawBody).digest();
  let receivedSignature;
  try {
    receivedSignature = Buffer.from(signature, "hex");
  } catch {
    return response.status(401).json({ message: "Invalid Paystack webhook signature." });
  }
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    return response.status(401).json({ message: "Invalid Paystack webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(request.rawBody.toString("utf8"));
  } catch {
    return response.status(400).json({ message: "Webhook body must be valid JSON." });
  }

  if (!["charge.success", "charge.failed"].includes(event.event)) {
    return response.status(200).json({ message: "Webhook event ignored." });
  }

  const transaction = event.data;
  const reference = transaction?.reference;
  if (!reference) {
    return response.status(400).json({ message: "Successful webhook is missing its payment reference." });
  }

  const payment = await prisma.payment.findUnique({
    where: { paystackReference: reference },
    include: { appointment: true, order: true },
  });
  const isAppointmentPayment = payment?.type === "DEPOSIT" && Boolean(payment.appointment);
  const isProductOrderPayment = payment?.type === "PRODUCT_ORDER" && Boolean(payment.order);
  const isWalletTopUp = payment?.type === "WALLET_TOP_UP";
  if (!payment || (!isAppointmentPayment && !isProductOrderPayment && !isWalletTopUp)) return response.status(404).json({ message: "Payment was not found." });
  const expectedMetadataId = isWalletTopUp ? payment.id : isProductOrderPayment ? payment.orderId : payment.appointmentId;
  const metadataIdKey = isWalletTopUp ? "walletTopUpId" : isProductOrderPayment ? "orderId" : "appointmentId";
  if (event.event === "charge.failed") {
    if (
      transaction.amount !== payment.amountKobo ||
      transaction.currency !== "NGN" ||
      transaction.metadata?.[metadataIdKey] !== expectedMetadataId ||
      (isWalletTopUp && transaction.metadata?.walletUserId !== payment.userId)
    ) {
      return response.status(400).json({ message: "Webhook payment details do not match the initialized payment." });
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.payment.updateMany({
        where: { id: payment.id, status: { in: ["INITIALIZED", "PENDING"] } },
        data: { status: "FAILED" },
      });
      if (isProductOrderPayment) await releaseProductOrderInventory(transaction, payment.orderId);
    });
    return response.status(200).json({ message: "Failed payment recorded." });
  }
  if (
    transaction.status !== "success" ||
    transaction.amount !== payment.amountKobo ||
    transaction.currency !== "NGN" ||
    transaction.metadata?.[metadataIdKey] !== expectedMetadataId ||
    (isWalletTopUp && transaction.metadata?.walletUserId !== payment.userId)
  ) {
    return response.status(400).json({ message: "Webhook payment details do not match the initialized payment." });
  }
  if (isWalletTopUp) {
    const settled = await settleWalletTopUp(payment.id, payment.paidAt || new Date());
    return response.status(200).json({ message: settled ? "Wallet top-up recorded." : "Wallet top-up was already settled." });
  }
  if (isProductOrderPayment) {
    if (payment.status === "SUCCESSFUL" && payment.order.paymentStatus === "SUCCESSFUL") {
      return response.status(200).json({ message: "Duplicate successful event ignored." });
    }
    const settled = await prisma.$transaction(async (transaction) => {
      const orderUpdate = await transaction.productOrder.updateMany({
        where: { id: payment.orderId, paymentStatus: { in: ["INITIALIZED", "PENDING"] }, inventoryReserved: true },
        data: { paymentStatus: "SUCCESSFUL", status: "PROCESSING" },
      });
      if (orderUpdate.count !== 1) return false;
      await transaction.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESSFUL", paidAt: payment.paidAt || new Date() },
      });
      return true;
    });
    return response.status(200).json({ message: settled ? "Product order payment recorded." : "Product order payment could not be matched to a reserved order and requires review." });
  }
  if (payment.status === "SUCCESSFUL" && payment.appointment.status === "CONFIRMED") {
    return response.status(200).json({ message: "Duplicate successful event ignored." });
  }

  const outcome = await prisma.$transaction(async (transactionClient) => {
    const confirmed = await transactionClient.appointment.updateMany({
      where: { id: payment.appointmentId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    });

    await transactionClient.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESSFUL", paidAt: payment.paidAt || new Date() },
    });

    if (confirmed.count === 1) {
      await transactionClient.appointmentStatusHistory.create({
        data: {
          appointmentId: payment.appointmentId,
          status: "CONFIRMED",
          note: "Upfront deposit, VAT, and applicable logistics payment verified by Paystack webhook",
        },
      });
    }
    return confirmed.count === 1;
  });

  return response.status(200).json({
    message: outcome
      ? "Payment recorded and appointment confirmed."
      : "Payment recorded; appointment was no longer pending and was not confirmed.",
  });
});

app.post(
  "/api/auth/signup",
  authRequestLimiter,
  [
    body("name").trim().isLength({ min: 2, max: 80 }),
    body("email").trim().isEmail().normalizeEmail(),
    body("password").isLength({ min: 8, max: 72 }),
    body("role").isIn(["CUSTOMER", "VENDOR"]),
    body("businessName").if(body("role").equals("VENDOR")).trim().isLength({ min: 2, max: 120 }),
    body("serviceCategory").if(body("role").equals("VENDOR")).trim().isLength({ min: 2, max: 80 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({
        message: "Please provide a valid name, email, password, and role.",
        errors: errors.array(),
      });
    }

    if (!process.env.JWT_SECRET) {
      return response.status(503).json({ message: "JWT authentication is not configured." });
    }
    if (!authEmailReady()) {
      return response.status(503).json({ message: "Email verification is not configured." });
    }

    const { name, email, password, role, businessName, serviceCategory } = request.body;
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return response.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        activeMode: role,
        emailVerified: false,
        ...(role === "VENDOR" ? {
          businesses: {
            create: {
              name: businessName.trim(),
              description: `${serviceCategory.trim()} services`,
              email,
            },
          },
        } : {}),
      },
    });
    try {
      await issueAuthEmailCode(user, "EMAIL_VERIFICATION");
    } catch {
      return response.status(503).json({
        message: "Account created, but verification email delivery failed. You can request another code from the verification screen.",
        emailVerificationRequired: true,
        email: user.email,
      });
    }

    return response.status(201).json({
      message: "Account created. Check your email for a verification code.",
      emailVerificationRequired: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, activeMode: user.activeMode },
    });
  },
);

app.post(
  "/api/auth/login",
  authRequestLimiter,
  [
    body("email").trim().isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 1 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ message: "A valid email and password are required.", errors: errors.array() });
    }

    if (!process.env.JWT_SECRET) {
      return response.status(503).json({ message: "JWT authentication is not configured." });
    }

    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);

    if (!user || !passwordMatches) {
      return response.status(401).json({ message: "Email or password is incorrect." });
    }
    if (!user.emailVerified) {
      return response.status(403).json({
        message: "Please verify your email before signing in.",
        emailVerificationRequired: true,
      });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role, activeMode: user.activeMode },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    return response.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        activeMode: user.activeMode,
      },
    });
  },
);

app.post(
  "/api/auth/verification/resend",
  authRequestLimiter,
  [body("email").trim().isEmail().normalizeEmail()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A valid email address is required." });
    if (!authEmailReady()) return response.status(503).json({ message: "Email verification is not configured." });

    const user = await prisma.user.findUnique({ where: { email: request.body.email } });
    if (user && !user.emailVerified) {
      try {
        await issueAuthEmailCode(user, "EMAIL_VERIFICATION");
      } catch {}
    }
    return response.status(202).json({ message: "If the account requires verification, a code will be sent to its email address." });
  },
);

app.post(
  "/api/auth/verify-email",
  authCodeLimiter,
  [
    body("email").trim().isEmail().normalizeEmail(),
    body("code").matches(/^\d{6}$/),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A valid email address and six-digit code are required." });
    if (!hasAuthCredentialPepper()) return response.status(503).json({ message: "Email verification is not configured." });

    const match = await findAuthEmailCode(request.body.email, "EMAIL_VERIFICATION", request.body.code);
    if (!match) return genericAuthCodeError(response);

    const now = new Date();
    const verified = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authCredential.updateMany({
        where: {
          id: match.credential.id,
          userId: match.user.id,
          purpose: "EMAIL_VERIFICATION",
          consumedAt: null,
          expiresAt: { gt: now },
          failedAttempts: { lt: authCredentialMaxAttempts },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({ where: { id: match.user.id }, data: { emailVerified: true } });
      await transaction.authCredential.updateMany({
        where: { userId: match.user.id, purpose: "EMAIL_VERIFICATION", consumedAt: null },
        data: { consumedAt: now },
      });
      return true;
    });
    if (!verified) return genericAuthCodeError(response);
    return response.json({ message: "Email verified. You can now sign in." });
  },
);

app.post(
  "/api/auth/forgot-password",
  authRequestLimiter,
  [body("email").trim().isEmail().normalizeEmail()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A valid email address is required." });
    if (!authEmailReady()) return response.status(503).json({ message: "Password recovery email is not configured." });

    const user = await prisma.user.findUnique({ where: { email: request.body.email } });
    if (user) {
      try {
        await issueAuthEmailCode(user, "PASSWORD_RESET");
      } catch {
        return response.status(202).json({ message: "If an account exists for that email, a recovery code will be sent." });
      }
    }
    return response.status(202).json({ message: "If an account exists for that email, a recovery code will be sent." });
  },
);

app.post(
  "/api/auth/reset-password",
  authCodeLimiter,
  [
    body("email").trim().isEmail().normalizeEmail(),
    body("code").matches(/^\d{6}$/),
    body("newPassword").isString().isLength({ min: 8 }).custom((value) => Buffer.byteLength(value, "utf8") <= 72),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a valid email, six-digit code, and password of 8 to 72 bytes." });
    if (!hasAuthCredentialPepper()) return response.status(503).json({ message: "Password recovery is not configured." });

    const match = await findAuthEmailCode(request.body.email, "PASSWORD_RESET", request.body.code);
    if (!match) return genericAuthCodeError(response);

    const passwordHash = await bcrypt.hash(request.body.newPassword, 12);
    const now = new Date();
    const reset = await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.authCredential.updateMany({
        where: {
          id: match.credential.id,
          userId: match.user.id,
          purpose: "PASSWORD_RESET",
          consumedAt: null,
          expiresAt: { gt: now },
          failedAttempts: { lt: authCredentialMaxAttempts },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      await transaction.user.update({ where: { id: match.user.id }, data: { passwordHash } });
      await transaction.authCredential.updateMany({
        where: { userId: match.user.id, purpose: "PASSWORD_RESET", consumedAt: null },
        data: { consumedAt: now },
      });
      return true;
    });
    if (!reset) return genericAuthCodeError(response);
    return response.json({ message: "Password reset successfully. Please sign in with your new password." });
  },
);

app.post(
  "/api/auth/mode",
  requireAuth,
  [body("mode").isIn(["CUSTOMER", "VENDOR"])],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ message: "Choose customer or vendor mode.", errors: errors.array() });
    }
    if (request.user.role !== "VENDOR") {
      return response.status(403).json({ message: "Only vendor accounts can switch modes." });
    }
    if (!process.env.JWT_SECRET) {
      return response.status(503).json({ message: "JWT authentication is not configured." });
    }

    const activeMode = request.body.mode;
    const user = await prisma.user.update({
      where: { id: request.user.sub },
      data: { activeMode },
      select: { id: true, role: true, activeMode: true },
    });
    const token = jwt.sign(
      { sub: user.id, role: user.role, activeMode: user.activeMode },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );
    return response.json({ message: `Switched to ${activeMode.toLowerCase()} mode.`, token, activeMode: user.activeMode });
  },
);

app.get("/api/users/me", requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { id: true, name: true, email: true, role: true, activeMode: true, createdAt: true },
  });

  if (!user) {
    return response.status(404).json({ message: "User was not found." });
  }

  return response.json({ user });
});

app.get("/api/customer/analytics", requireAuth, requireCustomerMode, async (request, response) => {
  const customerId = request.user.sub;
  const [appointmentGroups, orderGroups, upcomingAppointments, paidPayments, paidOrders] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.productOrder.groupBy({
      by: ["status"],
      where: { customerId },
      _count: { _all: true },
    }),
    prisma.appointment.count({
      where: { customerId, startAt: { gte: new Date() }, status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] } },
    }),
    prisma.payment.aggregate({
      where: { userId: customerId, status: "SUCCESSFUL" },
      _sum: { amountKobo: true },
      _count: { _all: true },
    }),
    prisma.productOrder.count({ where: { customerId, paymentStatus: "SUCCESSFUL" } }),
  ]);
  const appointmentCounts = Object.fromEntries(appointmentGroups.map((group) => [group.status, group._count._all]));
  const orderCounts = Object.fromEntries(orderGroups.map((group) => [group.status, group._count._all]));
  return response.json({
    appointments: {
      total: Object.values(appointmentCounts).reduce((total, count) => total + count, 0),
      upcoming: upcomingAppointments,
      completed: appointmentCounts.COMPLETED || 0,
      cancelled: appointmentCounts.CANCELLED || 0,
      noShows: appointmentCounts.NO_SHOW || 0,
    },
    orders: {
      total: Object.values(orderCounts).reduce((total, count) => total + count, 0),
      paid: paidOrders,
    },
    paidAmountKobo: paidPayments._sum.amountKobo || 0,
    successfulPaymentCount: paidPayments._count._all,
  });
});

app.get("/api/customer/wallet", requireAuth, requireCustomerMode, async (request, response) => {
  const wallet = await prisma.wallet.findUnique({
    where: { userId_mode: { userId: request.user.sub, mode: "CUSTOMER" } },
    select: { id: true, balanceKobo: true, currency: true, updatedAt: true },
  });
  if (!wallet) return response.json({ wallet: { balanceKobo: 0, currency: "NGN", totalTopUpsKobo: 0 }, transactions: [], pendingTopUps: [] });
  const [transactions, totals, pendingTopUps] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      include: { payment: { select: { status: true, paystackReference: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.walletTransaction.aggregate({
      where: { walletId: wallet.id, type: "CUSTOMER_TOP_UP", amountKobo: { gt: 0 } },
      _sum: { amountKobo: true },
    }),
    prisma.payment.findMany({
      where: { userId: request.user.sub, type: "WALLET_TOP_UP", status: "PENDING" },
      select: { id: true, amountKobo: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return response.json({
    wallet: { ...wallet, totalTopUpsKobo: totals._sum.amountKobo || 0 },
    transactions,
    pendingTopUps,
  });
});

app.post(
  "/api/customer/wallet/topups",
  requireAuth,
  requireCustomerMode,
  [body("amountKobo").isInt({ min: 10000, max: 500000000 }).toInt()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Top-up amount must be between ₦100 and ₦5,000,000.", errors: errors.array() });
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ message: "Paystack is not configured yet." });
    const user = await prisma.user.findUnique({ where: { id: request.user.sub }, select: { email: true } });
    if (!user) return response.status(404).json({ message: "Customer was not found." });

    const payment = await prisma.payment.create({
      data: {
        userId: request.user.sub,
        type: "WALLET_TOP_UP",
        status: "INITIALIZED",
        amountKobo: Number(request.body.amountKobo),
        paystackReference: randomUUID(),
        metadata: { walletMode: "CUSTOMER" },
      },
    });
    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL ? new URL(process.env.PAYSTACK_CALLBACK_URL) : null;
    callbackUrl?.searchParams.set("walletTopUpId", payment.id);
    try {
      const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: payment.amountKobo,
          currency: "NGN",
          reference: payment.paystackReference,
          metadata: { walletTopUpId: payment.id, walletUserId: request.user.sub },
          ...(callbackUrl ? { callback_url: callbackUrl.toString() } : {}),
        }),
      });
      const result = await paystackResponse.json();
      if (!paystackResponse.ok || !result.status || !result.data?.reference || !result.data?.authorization_url) {
        await prisma.payment.updateMany({ where: { id: payment.id, status: "INITIALIZED" }, data: { status: "FAILED", metadata: { walletMode: "CUSTOMER", error: "Paystack rejected top-up initialization" } } });
        return response.status(502).json({ message: "Paystack could not initialize this wallet top-up." });
      }
      const pending = await prisma.payment.updateMany({
        where: { id: payment.id, status: "INITIALIZED" },
        data: {
          status: "PENDING",
          paystackReference: result.data.reference,
          metadata: { walletMode: "CUSTOMER", authorizationUrl: result.data.authorization_url },
        },
      });
      if (pending.count !== 1) return response.status(409).json({ message: "Wallet top-up initialization is no longer active." });
      return response.status(201).json({ paymentId: payment.id, amountKobo: payment.amountKobo, authorizationUrl: result.data.authorization_url });
    } catch {
      await prisma.payment.updateMany({ where: { id: payment.id, status: "INITIALIZED" }, data: { status: "FAILED", metadata: { walletMode: "CUSTOMER", error: "Paystack initialization request failed" } } });
      return response.status(502).json({ message: "Paystack could not initialize this wallet top-up." });
    }
  },
);

app.post(
  "/api/customer/wallet/topups/:paymentId/verify",
  requireAuth,
  requireCustomerMode,
  [body("reference").isString().trim().notEmpty().isLength({ max: 200 })],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A valid Paystack reference is required.", errors: errors.array() });
    const payment = await prisma.payment.findUnique({ where: { id: request.params.paymentId } });
    if (!payment || payment.type !== "WALLET_TOP_UP" || payment.userId !== request.user.sub) {
      return response.status(404).json({ message: "Wallet top-up was not found." });
    }
    if (payment.status === "SUCCESSFUL") return response.json({ message: "Wallet top-up is already confirmed." });
    if (payment.status !== "PENDING" || payment.paystackReference !== request.body.reference.trim()) {
      return response.status(409).json({ message: "Wallet top-up is not awaiting this payment reference." });
    }
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ message: "Paystack is not configured yet." });
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.paystackReference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const verification = await verifyResponse.json();
    const transactionData = verification.data;
    if (!verifyResponse.ok || !verification.status || !transactionData) return response.status(502).json({ message: "Paystack could not verify this wallet top-up." });
    if (transactionData.status !== "success") return response.status(409).json({ message: "Wallet top-up has not succeeded." });
    if (transactionData.amount !== payment.amountKobo || transactionData.currency !== "NGN" || transactionData.metadata?.walletTopUpId !== payment.id || transactionData.metadata?.walletUserId !== request.user.sub) {
      return response.status(400).json({ message: "Verified payment details do not match this wallet top-up." });
    }
    const settled = await settleWalletTopUp(payment.id, new Date());
    if (!settled) return response.status(409).json({ message: "Wallet top-up settlement could not be completed." });
    return response.json({ message: "Wallet top-up verified and credited." });
  },
);

app.get("/api/vendor/analytics", requireAuth, requireVendor, async (request, response) => {
  const rangeName = String(request.query.range || "thisMonth");
  if (!analyticsRangeNames.includes(rangeName)) {
    return response.status(400).json({ message: "Analytics range must be 24h, 7d, 30d, 90d, thisMonth, lastMonth, or yearToDate." });
  }
  const range = resolveAnalyticsRange(rangeName);
  const vendorId = request.user.sub;
  const dateFilter = { gte: range.startAt, lt: range.endAt };
  const [appointments, appointmentPayments, paidFulfillments, firstVisits] = await Promise.all([
    prisma.appointment.findMany({
      where: { vendorId, startAt: dateFilter },
      select: {
        id: true,
        customerId: true,
        status: true,
        startAt: true,
        services: { select: { serviceId: true, serviceName: true, durationMin: true, priceKobo: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESSFUL", paidAt: dateFilter, appointment: { is: { vendorId } } },
      select: { amountKobo: true, paidAt: true },
    }),
    prisma.productOrderFulfillment.findMany({
      where: {
        vendorId,
        order: { is: { paymentStatus: "SUCCESSFUL", payments: { some: { status: "SUCCESSFUL", paidAt: dateFilter } } } },
      },
      select: {
        orderId: true,
        subtotalKobo: true,
        order: { select: { payments: { where: { status: "SUCCESSFUL", paidAt: dateFilter }, select: { paidAt: true } } } },
      },
    }),
    prisma.appointment.groupBy({
      by: ["customerId"],
      where: { vendorId },
      _min: { startAt: true },
    }),
  ]);

  const statuses = Object.fromEntries(adminAppointmentStatuses.map((status) => [status, 0]));
  const customerVisitCounts = new Map();
  const servicesById = new Map();
  const series = createAnalyticsSeries(range);
  const seriesByKey = new Map(series.map((bucket) => [bucket.key, bucket]));
  for (const appointment of appointments) {
    statuses[appointment.status] = (statuses[appointment.status] || 0) + 1;
    customerVisitCounts.set(appointment.customerId, (customerVisitCounts.get(appointment.customerId) || 0) + 1);
    const bucket = seriesByKey.get(getAnalyticsBucketKey(appointment.startAt, range.interval));
    if (bucket) bucket.bookings += 1;
    for (const service of appointment.services) {
      const current = servicesById.get(service.serviceId) || {
        serviceId: service.serviceId,
        name: service.serviceName,
        bookings: 0,
        revenueKobo: 0,
        durationMinutes: 0,
      };
      current.bookings += 1;
      current.revenueKobo += service.priceKobo;
      current.durationMinutes += service.durationMin;
      servicesById.set(service.serviceId, current);
    }
  }

  let appointmentRevenueKobo = 0;
  for (const payment of appointmentPayments) {
    appointmentRevenueKobo += payment.amountKobo;
    const bucket = seriesByKey.get(getAnalyticsBucketKey(payment.paidAt, range.interval));
    if (bucket) bucket.revenueKobo += payment.amountKobo;
  }
  let productRevenueKobo = 0;
  for (const fulfillment of paidFulfillments) {
    productRevenueKobo += fulfillment.subtotalKobo;
    const paidAt = fulfillment.order.payments[0]?.paidAt;
    const bucket = paidAt && seriesByKey.get(getAnalyticsBucketKey(paidAt, range.interval));
    if (bucket) bucket.revenueKobo += fulfillment.subtotalKobo;
  }

  const uniqueCustomers = customerVisitCounts.size;
  const newCustomerIds = new Set(firstVisits
    .filter((visit) => visit._min.startAt >= range.startAt && visit._min.startAt < range.endAt)
    .map((visit) => visit.customerId));
  const totalBookings = appointments.length;
  const servicePerformance = [...servicesById.values()]
    .map((service) => ({ ...service, averageDurationMinutes: Math.round(service.durationMinutes / service.bookings) }))
    .sort((left, right) => right.bookings - left.bookings || right.revenueKobo - left.revenueKobo)
    .slice(0, 5);

  return response.json({
    range: { name: rangeName, startAt: range.startAt, endAt: range.endAt, interval: range.interval },
    appointments: {
      total: totalBookings,
      completed: statuses.COMPLETED,
      cancelled: statuses.CANCELLED,
      noShows: statuses.NO_SHOW,
      pending: statuses.PENDING_PAYMENT,
      completionRate: totalBookings ? Number((statuses.COMPLETED / totalBookings * 100).toFixed(1)) : 0,
      cancellationRate: totalBookings ? Number((statuses.CANCELLED / totalBookings * 100).toFixed(1)) : 0,
      noShowRate: totalBookings ? Number((statuses.NO_SHOW / totalBookings * 100).toFixed(1)) : 0,
    },
    revenue: {
      totalKobo: appointmentRevenueKobo + productRevenueKobo,
      appointmentPaymentsKobo: appointmentRevenueKobo,
      paidProductFulfillmentsKobo: productRevenueKobo,
      averageAppointmentPaymentKobo: appointmentPayments.length
        ? Math.round(appointmentRevenueKobo / appointmentPayments.length)
        : 0,
    },
    customers: {
      unique: uniqueCustomers,
      new: [...newCustomerIds].filter((customerId) => customerVisitCounts.has(customerId)).length,
      returning: Math.max(0, uniqueCustomers - newCustomerIds.size),
    },
    products: {
      paidFulfillments: paidFulfillments.length,
      paidOrders: new Set(paidFulfillments.map((fulfillment) => fulfillment.orderId)).size,
    },
    serviceBookingsTotal: appointments.reduce((total, appointment) => total + appointment.services.length, 0),
    services: servicePerformance,
    series,
  });
});

app.get("/api/vendor/wallet", requireAuth, requireVendor, async (request, response) => {
  const range = String(request.query.range || "6M");
  if (!["6M", "1Y", "ALL"].includes(range)) return response.status(400).json({ message: "Wallet chart range must be 6M, 1Y, or ALL." });
  const wallet = await prisma.wallet.findUnique({
    where: { userId_mode: { userId: request.user.sub, mode: "VENDOR" } },
    select: { id: true, balanceKobo: true, currency: true, updatedAt: true },
  });
  if (!wallet) {
    return response.json({ wallet: { balanceKobo: 0, currency: "NGN" }, earnedKobo: 0, pendingWithdrawalKobo: 0, transactions: [], withdrawals: [], series: [] });
  }
  const earningTypes = ["APPOINTMENT_EARNING", "PRODUCT_EARNING"];
  const rangeStart = range === "ALL" ? null : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (range === "6M" ? 5 : 11), 1));
  const [transactions, earnings, pendingWithdrawals, withdrawals, chartEntries] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      include: { withdrawal: { select: { id: true, amountKobo: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.walletTransaction.aggregate({ where: { walletId: wallet.id, type: { in: earningTypes }, amountKobo: { gt: 0 } }, _sum: { amountKobo: true } }),
    prisma.walletWithdrawal.aggregate({ where: { walletId: wallet.id, status: { in: ["REQUESTED", "PROCESSING"] } }, _sum: { amountKobo: true } }),
    prisma.walletWithdrawal.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.walletTransaction.findMany({
      where: { walletId: wallet.id, type: { in: earningTypes }, ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}) },
      select: { amountKobo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const now = new Date();
  const firstChartEntry = chartEntries[0]?.createdAt || now;
  const seriesStart = rangeStart || new Date(Date.UTC(firstChartEntry.getUTCFullYear(), firstChartEntry.getUTCMonth(), 1));
  const currentMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const seriesStartMonthIndex = seriesStart.getUTCFullYear() * 12 + seriesStart.getUTCMonth();
  const bucketCount = range === "6M" ? 6 : range === "1Y" ? 12 : Math.max(1, currentMonthIndex - seriesStartMonthIndex + 1);
  const series = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(Date.UTC(seriesStart.getUTCFullYear(), seriesStart.getUTCMonth() + index, 1));
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleString("en-NG", { month: "short", year: "2-digit", timeZone: "UTC" }), amountKobo: 0 };
  });
  const seriesByKey = new Map(series.map((item) => [item.key, item]));
  for (const entry of chartEntries) {
    const bucket = seriesByKey.get(entry.createdAt.toISOString().slice(0, 7));
    if (bucket) bucket.amountKobo += entry.amountKobo;
  }
  return response.json({
    wallet,
    earnedKobo: earnings._sum.amountKobo || 0,
    pendingWithdrawalKobo: pendingWithdrawals._sum.amountKobo || 0,
    transactions,
    withdrawals,
    range,
    series,
  });
});

app.post(
  "/api/vendor/wallet/withdrawals",
  requireAuth,
  requireVendor,
  [body("amountKobo").isInt({ min: 10000, max: 500000000 }).toInt()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Withdrawal amount must be between ₦100 and ₦5,000,000.", errors: errors.array() });
    try {
      const withdrawal = await prisma.$transaction(async (transaction) => {
        const wallet = await ensureWallet(transaction, request.user.sub, "VENDOR");
        const requestRecord = await transaction.walletWithdrawal.create({
          data: { walletId: wallet.id, amountKobo: Number(request.body.amountKobo) },
        });
        await postWalletTransaction(transaction, {
          userId: request.user.sub,
          mode: "VENDOR",
          type: "WITHDRAWAL_HOLD",
          amountKobo: -Number(request.body.amountKobo),
          sourceKey: `withdrawal:${requestRecord.id}:hold`,
          description: "Withdrawal request held for review; no external payout has been sent",
          withdrawalId: requestRecord.id,
        });
        return requestRecord;
      });
      return response.status(201).json({ message: "Withdrawal request submitted for review. No payout has been sent.", withdrawal });
    } catch (error) {
      if (error.message === "WALLET_INSUFFICIENT_BALANCE") return response.status(409).json({ message: "Available wallet balance is insufficient for this withdrawal." });
      throw error;
    }
  },
);

app.delete("/api/vendor/wallet/withdrawals/:withdrawalId", requireAuth, requireVendor, async (request, response) => {
  try {
    const cancelled = await prisma.$transaction(async (transaction) => {
      const wallet = await transaction.wallet.findUnique({ where: { userId_mode: { userId: request.user.sub, mode: "VENDOR" } } });
      if (!wallet) return false;
      const updated = await transaction.walletWithdrawal.updateMany({
        where: { id: request.params.withdrawalId, walletId: wallet.id, status: "REQUESTED" },
        data: { status: "CANCELLED" },
      });
      if (updated.count !== 1) return false;
      const withdrawal = await transaction.walletWithdrawal.findUnique({ where: { id: request.params.withdrawalId } });
      await postWalletTransaction(transaction, {
        userId: request.user.sub,
        mode: "VENDOR",
        type: "WITHDRAWAL_RELEASE",
        amountKobo: withdrawal.amountKobo,
        sourceKey: `withdrawal:${withdrawal.id}:release`,
        description: "Cancelled withdrawal request; held balance released",
        withdrawalId: withdrawal.id,
      });
      return true;
    });
    if (!cancelled) return response.status(409).json({ message: "Only your requested withdrawal can be cancelled." });
    return response.json({ message: "Withdrawal request cancelled and balance released." });
  } catch (error) {
    throw error;
  }
});

const adminAppointmentStatuses = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"];

app.get("/api/admin/overview", requireAuth, requireAdmin, async (request, response) => {
  const [users, vendors, customers, businesses, activeBusinesses, appointments, pendingAppointments, products] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "VENDOR" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    prisma.appointment.count(),
    prisma.appointment.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.product.count(),
  ]);
  return response.json({ overview: { users, vendors, customers, businesses, activeBusinesses, appointments, pendingAppointments, products } });
});

app.get("/api/admin/analytics", requireAuth, requireAdmin, async (request, response) => {
  const rangeName = String(request.query.range || "30d");
  if (!analyticsRangeNames.includes(rangeName)) {
    return response.status(400).json({ message: "Analytics range must be 24h, 7d, 30d, 90d, thisMonth, lastMonth, or yearToDate." });
  }
  const range = resolveAnalyticsRange(rangeName);
  const dateFilter = { gte: range.startAt, lt: range.endAt };
  const [appointments, payments, orders, newUsers, totalUsers, customers, vendors, businesses, activeBusinesses, activeProducts, activeServices, serviceBookings] = await Promise.all([
    prisma.appointment.findMany({
      where: { startAt: dateFilter },
      select: { status: true, startAt: true },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESSFUL", paidAt: dateFilter },
      select: { type: true, amountKobo: true, paidAt: true },
    }),
    prisma.productOrder.groupBy({
      by: ["status"],
      where: { createdAt: dateFilter },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { createdAt: dateFilter } }),
    prisma.user.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "VENDOR" } }),
    prisma.business.count(),
    prisma.business.count({ where: { isActive: true } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.appointmentService.findMany({
      where: { appointment: { is: { startAt: dateFilter } } },
      select: {
        serviceId: true,
        serviceName: true,
        durationMin: true,
        priceKobo: true,
        service: { select: { category: { select: { name: true } } } },
      },
    }),
  ]);

  const appointmentCounts = Object.fromEntries(adminAppointmentStatuses.map((status) => [status, 0]));
  const orderCounts = Object.fromEntries(orders.map((group) => [group.status, group._count._all]));
  const series = createAnalyticsSeries(range);
  const seriesByKey = new Map(series.map((bucket) => [bucket.key, bucket]));
  for (const appointment of appointments) {
    appointmentCounts[appointment.status] = (appointmentCounts[appointment.status] || 0) + 1;
    const bucket = seriesByKey.get(getAnalyticsBucketKey(appointment.startAt, range.interval));
    if (bucket) bucket.bookings += 1;
  }
  const revenueByTypeKobo = { appointments: 0, productOrders: 0 };
  for (const payment of payments) {
    const key = payment.type === "PRODUCT_ORDER" ? "productOrders" : "appointments";
    revenueByTypeKobo[key] += payment.amountKobo;
    const bucket = seriesByKey.get(getAnalyticsBucketKey(payment.paidAt, range.interval));
    if (bucket) bucket.revenueKobo += payment.amountKobo;
  }
  const servicesById = new Map();
  for (const booking of serviceBookings) {
    const current = servicesById.get(booking.serviceId) || { serviceId: booking.serviceId, name: booking.serviceName, category: booking.service.category?.name || "Uncategorised", bookings: 0, durationMinutes: 0, revenueKobo: 0 };
    current.bookings += 1;
    current.durationMinutes += booking.durationMin;
    current.revenueKobo += booking.priceKobo;
    servicesById.set(booking.serviceId, current);
  }
  const totalAppointments = appointments.length;
  return response.json({
    range: { name: rangeName, startAt: range.startAt, endAt: range.endAt, interval: range.interval },
    platform: { users: totalUsers, customers, vendors, businesses, activeBusinesses, activeProducts, activeServices, newUsers },
    appointments: {
      total: totalAppointments,
      pending: appointmentCounts.PENDING_PAYMENT,
      confirmed: appointmentCounts.CONFIRMED,
      checkedIn: appointmentCounts.CHECKED_IN,
      completed: appointmentCounts.COMPLETED,
      cancelled: appointmentCounts.CANCELLED,
      noShows: appointmentCounts.NO_SHOW,
      completionRate: totalAppointments ? Number((appointmentCounts.COMPLETED / totalAppointments * 100).toFixed(1)) : 0,
      cancellationRate: totalAppointments ? Number((appointmentCounts.CANCELLED / totalAppointments * 100).toFixed(1)) : 0,
    },
    revenue: {
      totalKobo: revenueByTypeKobo.appointments + revenueByTypeKobo.productOrders,
      appointmentsKobo: revenueByTypeKobo.appointments,
      productOrdersKobo: revenueByTypeKobo.productOrders,
      successfulPayments: payments.length,
    },
    orders: {
      total: Object.values(orderCounts).reduce((total, count) => total + count, 0),
      byStatus: orderCounts,
    },
    services: [...servicesById.values()]
      .map((service) => ({ ...service, averageDurationMinutes: Math.round(service.durationMinutes / service.bookings) }))
      .sort((left, right) => right.bookings - left.bookings)
      .slice(0, 5),
    serviceBookingsTotal: serviceBookings.length,
    serviceCategories: Object.values([...servicesById.values()].reduce((categories, service) => {
      const category = categories[service.category] || { name: service.category, bookings: 0, revenueKobo: 0 };
      category.bookings += service.bookings;
      category.revenueKobo += service.revenueKobo;
      categories[service.category] = category;
      return categories;
    }, {})).sort((left, right) => right.bookings - left.bookings).slice(0, 4),
    series,
  });
});

app.get("/api/admin/accounts", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const role = String(request.query.role || "").toUpperCase();
  const where = role && ["CUSTOMER", "VENDOR", "ADMIN"].includes(role) ? { role } : {};
  const [accounts, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, activeMode: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);
  return response.json({ accounts, total, take, skip });
});

app.patch(
  "/api/admin/accounts/:userId/status",
  requireAuth,
  requireAdmin,
  [body("isActive").isBoolean().toBoolean()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a valid account status.", errors: errors.array() });
    if (request.params.userId === request.user.sub && request.body.isActive === false) {
      return response.status(409).json({ message: "You cannot suspend your own admin account." });
    }
    const target = await prisma.user.findUnique({ where: { id: request.params.userId } });
    if (!target) return response.status(404).json({ message: "Account was not found." });
    if (target.role === "ADMIN" && target.isActive && request.body.isActive === false) {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
      if (activeAdmins <= 1) return response.status(409).json({ message: "The last active admin cannot be suspended." });
    }
    const account = await prisma.user.update({
      where: { id: target.id },
      data: { isActive: request.body.isActive },
      select: { id: true, name: true, email: true, role: true, activeMode: true, isActive: true },
    });
    return response.json({ message: account.isActive ? "Account reactivated." : "Account suspended.", account });
  },
);

app.get("/api/admin/listings", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true, isActive: true } },
        _count: { select: { services: true, products: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.business.count(),
  ]);
  return response.json({ businesses, total, take, skip });
});

app.get("/api/admin/services", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const businessId = String(request.query.businessId || "").trim();
  const where = businessId ? { businessId } : {};
  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: { business: { select: { id: true, name: true, isActive: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.service.count({ where }),
  ]);
  return response.json({ services, total, take, skip });
});

app.get("/api/admin/products", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const businessId = String(request.query.businessId || "").trim();
  const where = businessId ? { businessId } : {};
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { business: { select: { id: true, name: true, isActive: true, owner: { select: { id: true, name: true, email: true, isActive: true } } } } },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.product.count({ where }),
  ]);
  return response.json({ products, total, take, skip });
});

app.patch(
  "/api/admin/businesses/:businessId/status",
  requireAuth,
  requireAdmin,
  [body("isActive").isBoolean().toBoolean()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a valid listing status.", errors: errors.array() });
    const updated = await prisma.business.updateMany({
      where: { id: request.params.businessId },
      data: { isActive: request.body.isActive },
    });
    if (updated.count !== 1) return response.status(404).json({ message: "Business listing was not found." });
    return response.json({ message: request.body.isActive ? "Business listing is active." : "Business listing is hidden." });
  },
);

app.patch(
  "/api/admin/services/:serviceId/status",
  requireAuth,
  requireAdmin,
  [body("isActive").isBoolean().toBoolean()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a valid service status.", errors: errors.array() });
    const updated = await prisma.service.updateMany({
      where: { id: request.params.serviceId },
      data: { isActive: request.body.isActive },
    });
    if (updated.count !== 1) return response.status(404).json({ message: "Service listing was not found." });
    return response.json({ message: request.body.isActive ? "Service listing is active." : "Service listing is hidden." });
  },
);

app.patch(
  "/api/admin/products/:productId/status",
  requireAuth,
  requireAdmin,
  [body("status").isIn(["ACTIVE", "DRAFT"])],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Choose ACTIVE or DRAFT.", errors: errors.array() });
    const updated = await prisma.product.updateMany({
      where: { id: request.params.productId },
      data: { status: request.body.status },
    });
    if (updated.count !== 1) return response.status(404).json({ message: "Product listing was not found." });
    return response.json({ message: request.body.status === "ACTIVE" ? "Product listing is active." : "Product listing is hidden." });
  },
);

app.get("/api/admin/appointments", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const status = String(request.query.status || "").toUpperCase();
  if (status && !adminAppointmentStatuses.includes(status)) {
    return response.status(400).json({ message: "Appointment status is invalid." });
  }
  const where = status ? { status } : {};
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        vendor: { select: { id: true, name: true, email: true } },
        business: { select: { id: true, name: true } },
        payments: { select: { id: true, type: true, status: true, amountKobo: true, currency: true, paystackReference: true, paidAt: true } },
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.appointment.count({ where }),
  ]);
  return response.json({ appointments, total, take, skip });
});

const conversationReportStatuses = ["OPEN", "REVIEWED", "RESOLVED"];

app.get("/api/admin/blocks", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const [blocks, total] = await Promise.all([
    prisma.conversationBlock.findMany({
      select: {
        id: true,
        createdAt: true,
        blocker: { select: { id: true, name: true, email: true } },
        blockedUser: { select: { id: true, name: true, email: true } },
        conversation: { select: { id: true, business: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.conversationBlock.count(),
  ]);
  return response.json({ blocks, total, take, skip });
});

app.get("/api/admin/reports", requireAuth, requireAdmin, async (request, response) => {
  const take = Math.min(Math.max(Number.parseInt(request.query.take, 10) || 50, 1), 100);
  const skip = Math.max(Number.parseInt(request.query.skip, 10) || 0, 0);
  const status = String(request.query.status || "").toUpperCase();
  if (status && !conversationReportStatuses.includes(status)) {
    return response.status(400).json({ message: "Report status is invalid." });
  }
  const where = status ? { status } : {};
  const [reports, total, openCount] = await Promise.all([
    prisma.conversationReport.findMany({
      where,
      select: {
        id: true,
        conversationId: true,
        appointmentId: true,
        reason: true,
        details: true,
        attachmentMimeType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reporter: { select: { id: true, name: true, email: true } },
        reportedUser: { select: { id: true, name: true, email: true } },
        conversation: { include: { business: { select: { id: true, name: true } } } },
        appointment: { select: { id: true, status: true, startAt: true, endAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.conversationReport.count({ where }),
    prisma.conversationReport.count({ where: { status: "OPEN" } }),
  ]);
  return response.json({ reports, total, openCount, take, skip });
});

app.get("/api/admin/reports/:reportId/attachment", requireAuth, requireAdmin, async (request, response) => {
  const report = await prisma.conversationReport.findUnique({
    where: { id: request.params.reportId },
    select: { attachmentData: true, attachmentMimeType: true },
  });
  if (!report?.attachmentData || !report.attachmentMimeType) {
    return response.status(404).json({ message: "Report evidence was not found." });
  }
  const base64 = report.attachmentData.split(",", 2)[1];
  if (!base64) return response.status(404).json({ message: "Report evidence was not found." });
  response.type(report.attachmentMimeType);
  response.set("Content-Disposition", "inline");
  return response.send(Buffer.from(base64, "base64"));
});

app.patch(
  "/api/admin/reports/:reportId/status",
  requireAuth,
  requireAdmin,
  [body("status").isIn(conversationReportStatuses)],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Choose OPEN, REVIEWED, or RESOLVED.", errors: errors.array() });
    const updated = await prisma.conversationReport.updateMany({
      where: { id: request.params.reportId },
      data: { status: request.body.status },
    });
    if (updated.count !== 1) return response.status(404).json({ message: "Report was not found." });
    const report = await prisma.conversationReport.findUnique({
      where: { id: request.params.reportId },
      select: { id: true, status: true, updatedAt: true },
    });
    return response.json({ message: "Report status updated.", report });
  },
);

const publicBusinessSelect = {
  id: true,
  name: true,
  description: true,
  deliveryMode: true,
  breakagePercent: true,
  logisticsFeeKobo: true,
  owner: {
    select: {
      name: true,
      availability: {
        where: { isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  },
  locations: {
    select: { id: true, name: true, address: true, city: true },
  },
  services: {
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      priceKobo: true,
      category: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
    },
  },
};

app.get("/api/businesses", async (request, response) => {
  const businesses = await prisma.business.findMany({
    where: { isActive: true, owner: { isActive: true }, services: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: publicBusinessSelect,
  });

  return response.json({ businesses, vatRatePercent });
});

app.get("/api/customer/favorites", requireAuth, requireCustomerMode, async (request, response) => {
  const favorites = await prisma.customerFavorite.findMany({
    where: { customerId: request.user.sub },
    include: { business: { select: publicBusinessSelect } },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ favorites });
});

app.post(
  "/api/customer/favorites",
  requireAuth,
  requireCustomerMode,
  body("businessId").isUUID(),
  async (request, response) => {
    const validation = validationResult(request);
    if (!validation.isEmpty()) return response.status(400).json({ message: "Choose a valid business." });
    const business = await prisma.business.findFirst({
      where: { id: request.body.businessId, isActive: true, owner: { isActive: true }, services: { some: { isActive: true } } },
      select: { id: true },
    });
    if (!business) return response.status(404).json({ message: "Business was not found." });
    const favorite = await prisma.customerFavorite.upsert({
      where: { customerId_businessId: { customerId: request.user.sub, businessId: business.id } },
      create: { customerId: request.user.sub, businessId: business.id },
      update: {},
    });
    return response.status(201).json({ favorite });
  },
);

app.delete("/api/customer/favorites/:businessId", requireAuth, requireCustomerMode, async (request, response) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.businessId)) {
    return response.status(400).json({ message: "Choose a valid business." });
  }
  const result = await prisma.customerFavorite.deleteMany({
    where: { customerId: request.user.sub, businessId: request.params.businessId },
  });
  return response.json({ removed: result.count > 0 });
});

app.get("/api/businesses/:businessId", async (request, response) => {
  const business = await prisma.business.findFirst({
    where: { id: request.params.businessId, isActive: true, owner: { isActive: true } },
    select: publicBusinessSelect,
  });

  if (!business) {
    return response.status(404).json({ message: "Business was not found." });
  }

  return response.json({ business });
});

app.get("/api/businesses/:businessId/slots", async (request, response) => {
  const date = String(request.query.date || "");
  const durationMin = Number(request.query.durationMin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(durationMin) || durationMin < 30 || durationMin % 30 !== 0) {
    return response.status(400).json({ message: "Provide a valid date and a service duration in 30-minute increments." });
  }
  const [year, month, day] = date.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.toISOString().slice(0, 10) !== date) {
    return response.status(400).json({ message: "The selected date is invalid." });
  }
  const business = await prisma.business.findFirst({
    where: { id: request.params.businessId, isActive: true, owner: { isActive: true } },
    select: { ownerId: true },
  });
  if (!business) return response.status(404).json({ message: "Business was not found." });

  const dayOfWeek = dateCheck.getUTCDay();
  const dayStart = new Date(Date.UTC(year, month - 1, day, -1));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
  const [availability, blockouts, bookedSlots] = await Promise.all([
    prisma.availability.findMany({ where: { vendorId: business.ownerId, dayOfWeek, isActive: true } }),
    prisma.blockoutDate.findMany({
      where: { vendorId: business.ownerId, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.appointmentSlot.findMany({
      where: {
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
        appointment: { vendorId: business.ownerId, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  const now = Date.now();
  const slots = [];
  for (const window of availability) {
    const [startHour, startMinute] = window.startTime.split(":").map(Number);
    const [endHour, endMinute] = window.endTime.split(":").map(Number);
    const windowStart = startHour * 60 + startMinute;
    const windowEnd = endHour * 60 + endMinute;
    for (let minute = windowStart; minute + durationMin <= windowEnd; minute += 30) {
      const startsAt = new Date(dayStart.getTime() + minute * 60000);
      const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
      if (startsAt.getTime() <= now) continue;
      const overlaps = (range) => range.startsAt < endsAt && range.endsAt > startsAt;
      if (blockouts.some(overlaps) || bookedSlots.some(overlaps)) continue;
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    }
  }
  return response.json({ date, durationMin, slots });
});

app.get("/api/vendor/business", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: request.user.sub },
    select: {
      id: true,
      name: true,
      description: true,
      deliveryMode: true,
      breakagePercent: true,
      logisticsFeeKobo: true,
    },
  });

  if (!business) {
    return response.status(404).json({ message: "Vendor business was not found." });
  }
  return response.json({ business });
});

app.patch(
  "/api/vendor/business",
  requireAuth,
  requireVendor,
  [
    body("name").optional().trim().isLength({ min: 2, max: 120 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("deliveryMode").optional().isIn(["STUDIO_ONLY", "HOME_SERVICE_ONLY", "BOTH"]),
    body("breakagePercent").optional().isInt({ min: 20, max: 30 }),
    body("logisticsFeeKobo").optional().isInt({ min: 0 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({
        message: "Provide valid business profile and booking settings.",
        errors: errors.array(),
      });
    }
    const fields = ["name", "description", "deliveryMode", "breakagePercent", "logisticsFeeKobo"];
    const data = Object.fromEntries(fields
      .filter((field) => request.body[field] !== undefined)
      .map((field) => [field, ["breakagePercent", "logisticsFeeKobo"].includes(field) ? Number(request.body[field]) : request.body[field]]));
    if (!Object.keys(data).length) {
      return response.status(400).json({ message: "Provide at least one business field to update." });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: request.user.sub },
    });
    if (!business) {
      return response.status(404).json({ message: "Vendor business was not found." });
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data,
      select: {
        id: true,
        name: true,
        description: true,
        deliveryMode: true,
        breakagePercent: true,
        logisticsFeeKobo: true,
      },
    });

    return response.json({ business: updatedBusiness });
  },
);

app.get("/api/vendor/schedule", requireAuth, requireVendor, async (request, response) => {
  const vendorId = request.user.sub;
  const [availability, blockouts, appointments] = await Promise.all([
    prisma.availability.findMany({
      where: { vendorId, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.blockoutDate.findMany({
      where: { vendorId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.appointment.findMany({
      where: { vendorId, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      include: {
        customer: { select: { name: true } },
        services: { select: { serviceName: true } },
      },
      orderBy: { startAt: "asc" },
      take: 100,
    }),
  ]);
  return response.json({ availability, blockouts, appointments });
});

app.put(
  "/api/vendor/availability",
  requireAuth,
  requireVendor,
  [
    body("windows").isArray({ max: 21 }),
    body("windows.*.dayOfWeek").isInt({ min: 0, max: 6 }),
    body("windows.*.startTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
    body("windows.*.endTime").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ message: "Provide valid weekly working hours.", errors: errors.array() });
    }

    const windows = request.body.windows.map((window) => ({
      vendorId: request.user.sub,
      dayOfWeek: Number(window.dayOfWeek),
      startTime: window.startTime,
      endTime: window.endTime,
      isActive: true,
    }));
    const sortedWindows = [...windows].sort((left, right) =>
      left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime),
    );
    for (let index = 0; index < sortedWindows.length; index += 1) {
      const current = sortedWindows[index];
      if (current.startTime >= current.endTime) {
        return response.status(400).json({ message: "Working-hour end times must be after their start times." });
      }
      const previous = sortedWindows[index - 1];
      if (previous?.dayOfWeek === current.dayOfWeek && previous.endTime > current.startTime) {
        return response.status(400).json({ message: "Working-hour windows cannot overlap." });
      }
    }

    const saved = await prisma.$transaction(async (transaction) => {
      await transaction.availability.deleteMany({ where: { vendorId: request.user.sub } });
      if (windows.length) {
        await transaction.availability.createMany({ data: windows });
      }
      return transaction.availability.findMany({
        where: { vendorId: request.user.sub, isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    });
    return response.json({ message: "Working hours saved.", availability: saved });
  },
);

app.post(
  "/api/vendor/blockouts",
  requireAuth,
  requireVendor,
  [
    body("startsAt").isISO8601(),
    body("endsAt").isISO8601(),
    body("reason").optional().isString().trim().isLength({ max: 300 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ message: "Provide valid blockout details.", errors: errors.array() });
    }
    const startsAt = new Date(request.body.startsAt);
    const endsAt = new Date(request.body.endsAt);
    if (startsAt <= new Date() || endsAt <= startsAt) {
      return response.status(400).json({ message: "Blockout time must be in the future and end after it starts." });
    }
    const blockout = await prisma.blockoutDate.create({
      data: {
        vendorId: request.user.sub,
        startsAt,
        endsAt,
        reason: request.body.reason || null,
      },
    });
    return response.status(201).json({ message: "Blockout saved.", blockout });
  },
);

app.delete("/api/vendor/blockouts/:blockoutId", requireAuth, requireVendor, async (request, response) => {
  const deleted = await prisma.blockoutDate.deleteMany({
    where: { id: request.params.blockoutId, vendorId: request.user.sub },
  });
  if (deleted.count !== 1) return response.status(404).json({ message: "Blockout was not found." });
  return response.json({ message: "Blockout removed." });
});

app.get("/api/vendor/services", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
  if (!business) return response.status(404).json({ message: "Vendor business was not found." });
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    include: { category: { select: { name: true } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ services });
});

app.post(
  "/api/vendor/services",
  requireAuth,
  requireVendor,
  [
    body("name").trim().isLength({ min: 2, max: 120 }),
    body("category").trim().isLength({ min: 2, max: 80 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("durationMin").isInt({ min: 30, max: 1440 }).custom((value) => Number(value) % 30 === 0),
    body("priceKobo").isInt({ min: 100 }),
    body("imageUrl").optional({ nullable: true }).custom(isValidServiceImageReference),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Service details are invalid.", errors: errors.array() });
    const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
    if (!business) return response.status(404).json({ message: "Vendor business was not found." });
    const categoryName = request.body.category.trim();
    const category = await prisma.serviceCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        name: request.body.name.trim(),
        description: request.body.description?.trim() || null,
        durationMin: Number(request.body.durationMin),
        priceKobo: Number(request.body.priceKobo),
        ...(request.body.imageUrl ? { images: { create: [{ url: request.body.imageUrl }] } } : {}),
      },
      include: { category: { select: { name: true } }, images: true },
    });
    return response.status(201).json({ message: "Service created.", service });
  },
);

app.patch(
  "/api/vendor/services/:serviceId",
  requireAuth,
  requireVendor,
  [
    body("name").optional().trim().isLength({ min: 2, max: 120 }),
    body("category").optional().trim().isLength({ min: 2, max: 80 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("durationMin").optional().isInt({ min: 30, max: 1440 }).custom((value) => Number(value) % 30 === 0),
    body("priceKobo").optional().isInt({ min: 100 }),
    body("isActive").optional().isBoolean(),
    body("imageUrl").optional({ nullable: true }).custom(isValidServiceImageReference),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Service details are invalid.", errors: errors.array() });
    const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
    if (!business) return response.status(404).json({ message: "Vendor business was not found." });
    const existing = await prisma.service.findFirst({ where: { id: request.params.serviceId, businessId: business.id } });
    if (!existing) return response.status(404).json({ message: "Service was not found." });

    const data = {};
    for (const field of ["name", "description", "durationMin", "priceKobo", "isActive"]) {
      if (request.body[field] !== undefined) {
        data[field] = ["durationMin", "priceKobo"].includes(field) ? Number(request.body[field]) : request.body[field];
      }
    }
    if (request.body.category !== undefined) {
      const categoryName = request.body.category.trim();
      const category = await prisma.serviceCategory.upsert({
        where: { name: categoryName }, update: {}, create: { name: categoryName },
      });
      data.categoryId = category.id;
    }
    const imageProvided = request.body.imageUrl !== undefined;
    if (!Object.keys(data).length && !imageProvided) return response.status(400).json({ message: "Provide at least one service field to update." });
    const service = await prisma.$transaction(async (transaction) => {
      if (imageProvided) {
        await transaction.serviceImage.deleteMany({ where: { serviceId: existing.id } });
        if (request.body.imageUrl) {
          await transaction.serviceImage.create({
            data: { serviceId: existing.id, url: request.body.imageUrl, altText: data.name || existing.name },
          });
        }
      }
      const include = { category: { select: { name: true } }, images: true };
      return Object.keys(data).length
        ? transaction.service.update({ where: { id: existing.id }, data, include })
        : transaction.service.findUnique({ where: { id: existing.id }, include });
    });
    return response.json({ message: "Service updated.", service });
  },
);

app.delete("/api/vendor/services/:serviceId", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
  if (!business) return response.status(404).json({ message: "Vendor business was not found." });
  const archived = await prisma.service.updateMany({
    where: { id: request.params.serviceId, businessId: business.id },
    data: { isActive: false },
  });
  if (archived.count !== 1) return response.status(404).json({ message: "Service was not found." });
  return response.json({ message: "Service archived." });
});

app.get("/api/products", async (request, response) => {
  await releaseExpiredProductOrders();
  const category = String(request.query.category || "").trim();
  const search = String(request.query.search || "").trim();
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      stockQuantity: { gt: 0 },
      business: { isActive: true, owner: { isActive: true } },
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    include: { business: { select: { id: true, name: true, owner: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ products, vatRatePercent });
});

app.get("/api/products/:productId", async (request, response) => {
  const product = await prisma.product.findFirst({
    where: { id: request.params.productId, status: "ACTIVE", stockQuantity: { gt: 0 }, business: { isActive: true, owner: { isActive: true } } },
    include: { business: { select: { id: true, name: true, owner: { select: { name: true } } } } },
  });
  if (!product) return response.status(404).json({ message: "Product was not found." });
  return response.json({ product });
});

app.get("/api/vendor/products", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
  if (!business) return response.status(404).json({ message: "Vendor business was not found." });
  const products = await prisma.product.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ products });
});

app.post(
  "/api/vendor/products",
  requireAuth,
  requireVendor,
  [
    body("name").trim().isLength({ min: 1, max: 120 }),
    body("category").trim().isLength({ min: 1, max: 80 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("priceKobo").isInt({ min: 1 }),
    body("discountPercent").optional().isInt({ min: 0, max: 100 }),
    body("stockQuantity").isInt({ min: 0 }),
    body("status").isIn(["ACTIVE", "DRAFT"]),
    body("imageUrl").optional({ checkFalsy: true }).isURL({ require_tld: false }).isLength({ max: 2048 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Product details are invalid.", errors: errors.array() });
    const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
    if (!business) return response.status(404).json({ message: "Vendor business was not found." });

    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        name: request.body.name,
        category: request.body.category,
        description: request.body.description || null,
        priceKobo: Number(request.body.priceKobo),
        discountPercent: Number(request.body.discountPercent || 0),
        stockQuantity: Number(request.body.stockQuantity),
        status: request.body.status,
        imageUrl: request.body.imageUrl || null,
      },
    });
    return response.status(201).json({ message: "Product saved.", product });
  },
);

app.patch(
  "/api/vendor/products/:productId",
  requireAuth,
  requireVendor,
  [
    body("name").optional().trim().isLength({ min: 1, max: 120 }),
    body("category").optional().trim().isLength({ min: 1, max: 80 }),
    body("description").optional().isString().trim().isLength({ max: 2000 }),
    body("priceKobo").optional().isInt({ min: 1 }),
    body("discountPercent").optional().isInt({ min: 0, max: 100 }),
    body("stockQuantity").optional().isInt({ min: 0 }),
    body("status").optional().isIn(["ACTIVE", "DRAFT"]),
    body("imageUrl").optional({ checkFalsy: true }).isURL({ require_tld: false }).isLength({ max: 2048 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Product details are invalid.", errors: errors.array() });
    const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
    if (!business) return response.status(404).json({ message: "Vendor business was not found." });
    const existing = await prisma.product.findFirst({ where: { id: request.params.productId, businessId: business.id } });
    if (!existing) return response.status(404).json({ message: "Product was not found." });

    const fields = ["name", "category", "description", "priceKobo", "discountPercent", "stockQuantity", "status", "imageUrl"];
    const data = Object.fromEntries(fields.filter((field) => request.body[field] !== undefined).map((field) => [
      field,
      ["priceKobo", "discountPercent", "stockQuantity"].includes(field) ? Number(request.body[field]) : request.body[field],
    ]));
    if (!Object.keys(data).length) return response.status(400).json({ message: "Provide at least one product field to update." });
    const product = await prisma.product.update({ where: { id: existing.id }, data });
    return response.json({ message: "Product updated.", product });
  },
);

app.delete("/api/vendor/products/:productId", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({ where: { ownerId: request.user.sub } });
  if (!business) return response.status(404).json({ message: "Vendor business was not found." });
  const archived = await prisma.product.updateMany({
    where: { id: request.params.productId, businessId: business.id },
    data: { status: "DRAFT" },
  });
  if (archived.count !== 1) return response.status(404).json({ message: "Product was not found." });
  return response.json({ message: "Product archived." });
});

app.post(
  "/api/orders",
  requireAuth,
  requireCustomerMode,
  [
    body("items").isArray({ min: 1, max: 30 }),
    body("items.*.productId").isUUID(),
    body("items.*.quantity").isInt({ min: 1, max: 50 }),
    body("shippingName").trim().isLength({ min: 2, max: 120 }),
    body("shippingPhone").trim().isLength({ min: 7, max: 30 }),
    body("shippingAddress").trim().isLength({ min: 5, max: 300 }),
    body("shippingCity").trim().isLength({ min: 2, max: 100 }),
  ],
  async (request, response) => {
    await releaseExpiredProductOrders();
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Cart or shipping details are invalid.", errors: errors.array() });
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ message: "Paystack is not configured yet." });

    const quantities = new Map();
    request.body.items.forEach(({ productId, quantity }) => quantities.set(productId, (quantities.get(productId) || 0) + Number(quantity)));
    if ([...quantities.values()].some((quantity) => quantity > 50)) {
      return response.status(400).json({ message: "A maximum of 50 units per product can be ordered." });
    }
    const products = await prisma.product.findMany({
      where: {
        id: { in: [...quantities.keys()] },
        status: "ACTIVE",
        business: { isActive: true, owner: { isActive: true } },
      },
      include: { business: { select: { id: true, ownerId: true } } },
    });
    if (products.length !== quantities.size) return response.status(409).json({ message: "A product in your cart is no longer available." });
    for (const product of products) {
      if (product.stockQuantity < quantities.get(product.id)) {
        return response.status(409).json({ message: `${product.name} does not have enough stock.` });
      }
    }

    const lineItems = products.map((product) => {
      const quantity = quantities.get(product.id);
      const discountPercent = product.discountPercent;
      const unitDiscount = Math.round(product.priceKobo * discountPercent / 100);
      return {
        product,
        quantity,
        listPriceKobo: product.priceKobo,
        unitPriceKobo: product.priceKobo - unitDiscount,
        discountPercent,
        lineSubtotalKobo: product.priceKobo * quantity,
        lineDiscountKobo: unitDiscount * quantity,
      };
    });
    const subtotalKobo = lineItems.reduce((total, item) => total + item.lineSubtotalKobo, 0);
    const discountKobo = lineItems.reduce((total, item) => total + item.lineDiscountKobo, 0);
    const vatKobo = Math.round((subtotalKobo - discountKobo) * vatRatePercent / 100);
    const shippingKobo = 0;
    const totalKobo = subtotalKobo - discountKobo + vatKobo + shippingKobo;
    if (totalKobo < 1) return response.status(400).json({ message: "The discounted cart total must be greater than zero to check out." });
    const groupedItems = new Map();
    lineItems.forEach((item) => {
      const businessId = item.product.business.id;
      if (!groupedItems.has(businessId)) groupedItems.set(businessId, []);
      groupedItems.get(businessId).push(item);
    });

    try {
      const order = await prisma.$transaction(async (transaction) => {
        for (const item of lineItems) {
          const reserved = await transaction.product.updateMany({
            where: { id: item.product.id, status: "ACTIVE", stockQuantity: { gte: item.quantity } },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (reserved.count !== 1) throw new Error("PRODUCT_STOCK_UNAVAILABLE");
        }

        const createdOrder = await transaction.productOrder.create({
          data: {
            customerId: request.user.sub,
            status: "PENDING_PAYMENT",
            paymentStatus: "INITIALIZED",
            subtotalKobo,
            discountKobo,
            vatKobo,
            shippingKobo,
            totalKobo,
            shippingName: request.body.shippingName.trim(),
            shippingPhone: request.body.shippingPhone.trim(),
            shippingAddress: request.body.shippingAddress.trim(),
            shippingCity: request.body.shippingCity.trim(),
            expiresAt: new Date(Date.now() + 20 * 60 * 1000),
          },
        });

        for (const [businessId, items] of groupedItems) {
          const fulfillment = await transaction.productOrderFulfillment.create({
            data: {
              orderId: createdOrder.id,
              businessId,
              vendorId: items[0].product.business.ownerId,
              subtotalKobo: items.reduce((sum, item) => sum + item.unitPriceKobo * item.quantity, 0),
              items: {
                create: items.map((item) => ({
                  orderId: createdOrder.id,
                  productId: item.product.id,
                  productName: item.product.name,
                  productCategory: item.product.category,
                  imageUrl: item.product.imageUrl,
                  listPriceKobo: item.listPriceKobo,
                  unitPriceKobo: item.unitPriceKobo,
                  discountPercent: item.discountPercent,
                  quantity: item.quantity,
                })),
              },
            },
          });
          if (!fulfillment.id) throw new Error("ORDER_FULFILLMENT_CREATE_FAILED");
        }

        await transaction.payment.create({
          data: {
            orderId: createdOrder.id,
            userId: request.user.sub,
            type: "PRODUCT_ORDER",
            status: "INITIALIZED",
            amountKobo: totalKobo,
            paystackReference: randomUUID(),
          },
        });
        return transaction.productOrder.findUnique({
          where: { id: createdOrder.id },
          include: { fulfillments: { include: { items: true, business: { select: { name: true } } } } },
        });
      });
      return response.status(201).json({ message: "Order created and awaiting payment.", order });
    } catch (error) {
      if (error.message === "PRODUCT_STOCK_UNAVAILABLE") return response.status(409).json({ message: "A product sold out while your order was being placed. Please refresh your cart." });
      throw error;
    }
  },
);

app.get("/api/orders", requireAuth, requireCustomerMode, async (request, response) => {
  await releaseExpiredProductOrders();
  const orders = await prisma.productOrder.findMany({
    where: { customerId: request.user.sub },
    include: {
      items: true,
      fulfillments: { include: { business: { select: { id: true, name: true } }, items: true } },
      payments: { where: { type: "PRODUCT_ORDER" }, select: { status: true, paidAt: true, paystackReference: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ orders });
});

app.get("/api/vendor/orders", requireAuth, requireVendor, async (request, response) => {
  await releaseExpiredProductOrders();
  const fulfillments = await prisma.productOrderFulfillment.findMany({
    where: { vendorId: request.user.sub },
    include: {
      business: { select: { id: true, name: true } },
      items: true,
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          shippingName: true,
          shippingPhone: true,
          shippingAddress: true,
          shippingCity: true,
          createdAt: true,
          customer: { select: { id: true, name: true, email: true } },
          payments: { where: { type: "PRODUCT_ORDER" }, select: { status: true, paidAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ fulfillments });
});

app.patch(
  "/api/vendor/orders/:fulfillmentId/status",
  requireAuth,
  requireVendor,
  [body("status").isIn(["DISPATCHED", "COMPLETED"])],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Choose a valid order status.", errors: errors.array() });
    const fulfillment = await prisma.productOrderFulfillment.findFirst({
      where: { id: request.params.fulfillmentId, vendorId: request.user.sub },
      include: { order: true },
    });
    if (!fulfillment) return response.status(404).json({ message: "Order fulfillment was not found." });
    if (fulfillment.order.paymentStatus !== "SUCCESSFUL" || !["PROCESSING", "PARTIALLY_DISPATCHED", "DISPATCHED"].includes(fulfillment.order.status)) {
      return response.status(409).json({ message: "Only active paid orders can be fulfilled." });
    }
    const nextStatus = request.body.status;
    const validTransition = fulfillment.status === "PROCESSING"
      ? nextStatus === "DISPATCHED"
      : fulfillment.status === "DISPATCHED" && nextStatus === "COMPLETED";
    if (!validTransition) return response.status(409).json({ message: "That order status transition is not allowed." });

    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.productOrderFulfillment.update({
        where: { id: fulfillment.id },
        data: { status: nextStatus },
        include: { items: true, order: { include: { customer: { select: { name: true, email: true } } } } },
      });
      await updateProductOrderStatus(transaction, fulfillment.orderId);
      if (nextStatus === "COMPLETED" && fulfillment.order.paymentStatus === "SUCCESSFUL" && fulfillment.subtotalKobo > 0) {
        await postWalletTransaction(transaction, {
          userId: fulfillment.vendorId,
          mode: "VENDOR",
          type: "PRODUCT_EARNING",
          amountKobo: fulfillment.subtotalKobo,
          sourceKey: `product-fulfillment:${fulfillment.id}`,
          description: "Paid product fulfillment completed",
        });
      }
      return result;
    });
    return response.json({ message: "Order status updated.", fulfillment: updated });
  },
);

app.post("/api/payments/orders/:orderId", requireAuth, requireCustomerMode, async (request, response) => {
  await releaseExpiredProductOrders();
  const order = await prisma.productOrder.findUnique({
    where: { id: request.params.orderId },
    include: { customer: { select: { email: true } }, payments: { where: { type: "PRODUCT_ORDER" } } },
  });
  if (!order) return response.status(404).json({ message: "Order was not found." });
  if (order.customerId !== request.user.sub) return response.status(403).json({ message: "You cannot pay for this order." });
  if (order.paymentStatus === "SUCCESSFUL") return response.status(409).json({ message: "This order has already been paid." });
  if (order.status !== "PENDING_PAYMENT" || !order.inventoryReserved) return response.status(409).json({ message: "This order is no longer awaiting payment." });
  if (order.expiresAt <= new Date()) {
    return response.status(409).json({ message: "This order expired. Please checkout again." });
  }
  if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ message: "Paystack is not configured yet." });

  let payment = order.payments[0];
  if (!payment) return response.status(409).json({ message: "Order payment record was not found." });
  if (payment.status === "PENDING") {
    if (payment.metadata?.authorizationUrl) {
      return response.json({ reference: payment.paystackReference, authorizationUrl: payment.metadata.authorizationUrl, amountKobo: payment.amountKobo });
    }
    return response.status(409).json({ message: "Order payment initialization is already in progress." });
  }
  if (payment.status === "FAILED") {
    const retried = await prisma.payment.updateMany({
      where: { id: payment.id, status: "FAILED" },
      data: { status: "INITIALIZED", paystackReference: randomUUID(), metadata: null, updatedAt: new Date() },
    });
    if (retried.count !== 1) return response.status(409).json({ message: "Order payment retry is already in progress." });
    await prisma.productOrder.update({ where: { id: order.id }, data: { paymentStatus: "INITIALIZED" } });
    payment = await prisma.payment.findUnique({ where: { id: payment.id } });
  }

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "INITIALIZED" },
    data: { status: "PENDING", updatedAt: new Date() },
  });
  if (claimed.count !== 1) return response.status(409).json({ message: "Order payment initialization is already in progress." });
  payment = { ...payment, status: "PENDING" };

  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL ? new URL(process.env.PAYSTACK_CALLBACK_URL) : null;
  callbackUrl?.searchParams.set("orderId", order.id);
  callbackUrl?.searchParams.set("paymentType", "PRODUCT_ORDER");
  try {
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: order.customer.email,
        amount: order.totalKobo,
        currency: "NGN",
        reference: payment.paystackReference,
        metadata: { orderId: order.id, paymentType: "PRODUCT_ORDER" },
        ...(callbackUrl ? { callback_url: callbackUrl.toString() } : {}),
      }),
    });
    const result = await paystackResponse.json();
    if (!paystackResponse.ok || !result.status || !result.data?.reference || !result.data?.authorization_url) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", metadata: { error: "Paystack rejected order initialization" } } });
      return response.status(502).json({ message: "Paystack could not initialize this order payment." });
    }
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        paystackReference: result.data.reference,
        metadata: { accessCode: result.data.access_code, authorizationUrl: result.data.authorization_url },
      },
    });
    await prisma.productOrder.update({ where: { id: order.id }, data: { paymentStatus: "PENDING" } });
    return response.status(201).json({ reference: payment.paystackReference, authorizationUrl: result.data.authorization_url, amountKobo: payment.amountKobo });
  } catch {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", metadata: { error: "Paystack initialization request failed" } } });
    return response.status(502).json({ message: "Paystack could not initialize this order payment." });
  }
});

app.post(
  "/api/payments/orders/:orderId/verify",
  requireAuth,
  requireCustomerMode,
  [body("reference").trim().isLength({ min: 1 })],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "A Paystack reference is required.", errors: errors.array() });
    if (!process.env.PAYSTACK_SECRET_KEY) return response.status(503).json({ message: "Paystack is not configured yet." });
    const payment = await prisma.payment.findUnique({ where: { paystackReference: request.body.reference }, include: { order: true } });
    if (!payment || payment.type !== "PRODUCT_ORDER" || payment.orderId !== request.params.orderId || !payment.order) {
      return response.status(404).json({ message: "Product order payment was not found." });
    }
    if (payment.userId !== request.user.sub || payment.order.customerId !== request.user.sub) {
      return response.status(403).json({ message: "You cannot verify this order payment." });
    }
    if (payment.status === "SUCCESSFUL" && payment.order.paymentStatus === "SUCCESSFUL") {
      return response.json({ message: "Order payment is already confirmed.", order: payment.order });
    }
    if (!payment.order.inventoryReserved || payment.order.status === "PAYMENT_FAILED") {
      return response.status(409).json({ message: "This order is no longer available for payment." });
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(request.body.reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const verifyResult = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyResult.status || !verifyResult.data) return response.status(502).json({ message: "Paystack could not verify this payment." });
    const transactionData = verifyResult.data;
    if (transactionData.status !== "success") {
      if (["failed", "abandoned"].includes(transactionData.status)) {
        await prisma.$transaction(async (transaction) => {
          await transaction.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
          await releaseProductOrderInventory(transaction, payment.orderId);
        });
      }
      return response.status(409).json({ message: "Order payment has not succeeded." });
    }
    if (
      transactionData.amount !== payment.amountKobo ||
      transactionData.currency !== "NGN" ||
      transactionData.metadata?.orderId !== payment.orderId
    ) return response.status(400).json({ message: "Verified payment details do not match this order." });

    const order = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.productOrder.updateMany({
        where: { id: payment.orderId, paymentStatus: { in: ["INITIALIZED", "PENDING"] }, inventoryReserved: true },
        data: { paymentStatus: "SUCCESSFUL", status: "PROCESSING" },
      });
      if (updated.count !== 1) return null;
      await transaction.payment.update({ where: { id: payment.id }, data: { status: "SUCCESSFUL", paidAt: new Date() } });
      return transaction.productOrder.findUnique({ where: { id: payment.orderId } });
    });
    if (!order) return response.status(409).json({ message: "This order was already settled or released." });
    return response.json({ message: "Order payment verified.", order });
  },
);

app.post("/api/payments/orders/:orderId/wallet", requireAuth, requireCustomerMode, async (request, response) => {
  const order = await prisma.productOrder.findUnique({
    where: { id: request.params.orderId },
    include: { payments: { where: { type: "PRODUCT_ORDER" } } },
  });
  if (!order) return response.status(404).json({ message: "Order was not found." });
  if (order.customerId !== request.user.sub) return response.status(403).json({ message: "You cannot pay for this order." });
  if (order.paymentStatus === "SUCCESSFUL") return response.status(409).json({ message: "This order has already been paid." });
  if (order.status !== "PENDING_PAYMENT" || !order.inventoryReserved || order.expiresAt <= new Date()) {
    return response.status(409).json({ message: "This order is no longer awaiting payment." });
  }
  const payment = order.payments[0];
  if (!payment || !["INITIALIZED", "FAILED"].includes(payment.status)) {
    return response.status(409).json({ message: "An external Paystack payment is already in progress or this order cannot use wallet funds." });
  }
  try {
    const settled = await prisma.$transaction(async (transaction) => {
      const orderUpdate = await transaction.productOrder.updateMany({
        where: { id: order.id, customerId: request.user.sub, status: "PENDING_PAYMENT", paymentStatus: { in: ["INITIALIZED", "FAILED"] }, inventoryReserved: true, expiresAt: { gt: new Date() } },
        data: { paymentStatus: "SUCCESSFUL", status: "PROCESSING" },
      });
      if (orderUpdate.count !== 1) throw new Error("WALLET_ORDER_STATE_CHANGED");
      const paymentUpdate = await transaction.payment.updateMany({
        where: { id: payment.id, status: { in: ["INITIALIZED", "FAILED"] } },
        data: { status: "SUCCESSFUL", paidAt: new Date(), paystackReference: null, metadata: { collectionMethod: "CUSTOMER_WALLET" } },
      });
      if (paymentUpdate.count !== 1) throw new Error("WALLET_ORDER_STATE_CHANGED");
      await postWalletTransaction(transaction, {
        userId: request.user.sub,
        mode: "CUSTOMER",
        type: "ORDER_PAYMENT",
        amountKobo: -order.totalKobo,
        sourceKey: `wallet-order:${order.id}`,
        description: `Wallet payment for product order ${order.id.slice(0, 8)}`,
        paymentId: payment.id,
      });
      return transaction.productOrder.findUnique({ where: { id: order.id } });
    });
    return response.json({ message: "Product order paid with wallet funds.", order: settled });
  } catch (error) {
    if (error.message === "WALLET_INSUFFICIENT_BALANCE") return response.status(409).json({ message: "Wallet balance is insufficient for this order." });
    if (error.message === "WALLET_ORDER_STATE_CHANGED") return response.status(409).json({ message: "Order payment state changed. Refresh and try again." });
    throw error;
  }
});

app.post(
  "/api/appointments",
  requireAuth,
  requireCustomerMode,
  [
    body("serviceIds").isArray({ min: 1 }),
    body("serviceIds.*").isUUID(),
    body("slots").isArray({ min: 1 }),
    body("slots.*.startsAt").isISO8601(),
    body("slots.*.endsAt").isISO8601(),
    body("deliveryMode").isIn(["STUDIO", "HOME_SERVICE"]),
    body("notes").optional().isString().trim().isLength({ max: 500 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({
        message: "Please provide a customer, services, and valid time slots.",
        errors: errors.array(),
      });
    }

    const { serviceIds, slots, notes, deliveryMode } = request.body;
    const customerId = request.user.sub;
    const slotValues = slots.map((slot) => ({
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
    }));

    if (slotValues.some((slot) => slot.endsAt <= slot.startsAt)) {
      return response.status(400).json({
        message: "Each appointment slot must end after it starts.",
      });
    }
    slotValues.sort((left, right) => left.startsAt - right.startsAt);
    if (slotValues.some((slot, index) => index > 0 && slot.startsAt < slotValues[index - 1].endsAt)) {
      return response.status(400).json({ message: "Appointment slots cannot overlap." });
    }

    const customer = await prisma.user.findUnique({
      where: { id: customerId },
    });
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      include: { business: true },
    });

    if (!customer) {
      return response.status(404).json({ message: "Customer was not found." });
    }

    if (services.length !== new Set(serviceIds).size) {
      return response.status(404).json({
        message: "One or more services were not found or are inactive.",
      });
    }

    const businessIds = new Set(services.map((service) => service.businessId));
    if (businessIds.size !== 1) {
      return response.status(400).json({
        message: "Services in one appointment must belong to the same business.",
      });
    }

    const business = services[0].business;
    const vendorId = business.ownerId;
    const deliveryModeAllowed =
      business.deliveryMode === "BOTH" ||
      (business.deliveryMode === "STUDIO_ONLY" && deliveryMode === "STUDIO") ||
      (business.deliveryMode === "HOME_SERVICE_ONLY" && deliveryMode === "HOME_SERVICE");
    if (!deliveryModeAllowed) {
      return response.status(400).json({
        message: "The vendor does not offer the selected delivery mode.",
      });
    }

    if (customerId === vendorId) {
      return response.status(403).json({
        message: "A vendor cannot book their own services.",
      });
    }

    const firstSlotLocal = getLagosDayAndMinutes(slotValues[0].startsAt);
    const dayOfWeek = firstSlotLocal.dayOfWeek;
    const sameDay = slotValues.every((slot) =>
      getLagosDayAndMinutes(slot.startsAt).dayOfWeek === dayOfWeek,
    );
    if (!sameDay) {
      return response.status(400).json({
        message: "All selected slots must be on the same day.",
      });
    }

    const availability = await prisma.availability.findMany({
      where: {
        vendorId,
        dayOfWeek,
        isActive: true,
      },
    });
    const slotWithinAvailability = slotValues.every((slot) => {
      const start = getLagosDayAndMinutes(slot.startsAt).minutes;
      const end = getLagosDayAndMinutes(slot.endsAt).minutes;
      return availability.some((window) => {
        const [startHour, startMinute] = window.startTime.split(":").map(Number);
        const [endHour, endMinute] = window.endTime.split(":").map(Number);
        return (
          start >= startHour * 60 + startMinute &&
          end <= endHour * 60 + endMinute
        );
      });
    });

    if (!slotWithinAvailability) {
      return response.status(409).json({
        message: "One or more selected slots are outside vendor availability.",
      });
    }

    const appointmentStart = new Date(
      Math.min(...slotValues.map((slot) => slot.startsAt.getTime())),
    );
    const appointmentEnd = new Date(
      Math.max(...slotValues.map((slot) => slot.endsAt.getTime())),
    );
    const blockout = await prisma.blockoutDate.findFirst({
      where: {
        vendorId,
        startsAt: { lt: appointmentEnd },
        endsAt: { gt: appointmentStart },
      },
    });

    if (blockout) {
      return response.status(409).json({
        message: "The selected time overlaps a vendor blockout period.",
      });
    }

    const conflict = await prisma.appointmentSlot.findFirst({
      where: {
        startsAt: { lt: appointmentEnd },
        endsAt: { gt: appointmentStart },
        appointment: {
          vendorId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      },
    });

    if (conflict) {
      return response.status(409).json({
        message: "One or more selected slots are already booked.",
      });
    }

    const subtotalKobo = services.reduce(
      (total, service) => total + service.priceKobo,
      0,
    );
    const selectedDurationMin = services.reduce((total, service) => total + service.durationMin, 0);
    const selectedSlotDurationMin = slotValues.reduce(
      (total, slot) => total + (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000,
      0,
    );
    if (selectedSlotDurationMin !== selectedDurationMin) {
      return response.status(400).json({
        message: "Selected appointment time must match the total duration of the chosen services.",
      });
    }

    const depositPercent = business.breakagePercent;
    const depositKobo = Math.round((subtotalKobo * depositPercent) / 100);
    const logisticsFeeKobo = deliveryMode === "HOME_SERVICE" ? business.logisticsFeeKobo : 0;
    const vatKobo = Math.round(((subtotalKobo + logisticsFeeKobo) * vatRatePercent) / 100);

    const appointment = await prisma.$transaction(async (transaction) => {
      const created = await transaction.appointment.create({
        data: {
          customerId,
          vendorId,
          businessId: business.id,
          deliveryMode,
          startAt: appointmentStart,
          endAt: appointmentEnd,
          subtotalKobo,
          depositPercent,
          depositKobo,
          vatKobo,
          logisticsFeeKobo,
          notes,
          services: {
            create: services.map((service) => ({
              serviceId: service.id,
              serviceName: service.name,
              durationMin: service.durationMin,
              priceKobo: service.priceKobo,
            })),
          },
          slots: {
            create: slotValues.map((slot) => ({
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
            })),
          },
          statusHistory: {
            create: {
              status: "PENDING_PAYMENT",
              note: `Awaiting ${deliveryMode === "HOME_SERVICE" ? "home service" : "studio"} deposit payment`,
            },
          },
        },
        include: { services: true, slots: true },
      });

      return created;
    });

    return response.status(201).json({
      message: "Appointment created and awaiting deposit payment.",
      appointment,
      upfrontAmountKobo: depositKobo + vatKobo + logisticsFeeKobo,
    });
  },
);

app.get("/api/appointments", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const userId = request.user.sub;
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(request.user.activeMode === "VENDOR"
        ? { vendorId: userId }
        : { customerId: userId }),
    },
    include: {
      services: true,
      slots: true,
      ...(request.user.activeMode === "CUSTOMER"
        ? {
            vendor: { select: { id: true, name: true } },
            business: {
              select: {
                id: true,
                name: true,
                locations: { select: { name: true, address: true, city: true } },
              },
            },
          }
        : {}),
      ...(request.user.activeMode === "VENDOR"
        ? { customer: { select: { id: true, name: true, email: true } } }
        : {}),
    },
    orderBy: { startAt: "asc" },
  });

  return response.json({ appointments });
});

app.get("/api/appointments/:appointmentId", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
    include: { services: true, slots: true, statusHistory: true },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const canAccess = request.user.activeMode === "VENDOR"
    ? appointment.vendorId === request.user.sub
    : appointment.customerId === request.user.sub;
  if (!canAccess) {
    return response.status(403).json({ message: "You cannot access this appointment." });
  }

  return response.json({ appointment });
});

app.post("/api/appointments/:appointmentId/cancel", requireAuth, requireCustomerOrVendorMode, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const actorId = request.user.sub;
  const isCustomerAction = request.user.activeMode === "CUSTOMER" && actorId === appointment.customerId;
  const isVendorAction = request.user.activeMode === "VENDOR" && actorId === appointment.vendorId;
  if (!isCustomerAction && !isVendorAction) {
    return response.status(403).json({ message: "You cannot cancel this appointment." });
  }

  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) {
    return response.status(409).json({ message: "This appointment cannot be cancelled." });
  }

  const minutesUntilStart = (appointment.startAt.getTime() - Date.now()) / 60000;
  const vendorReleasingUnpaidSlot = isVendorAction && appointment.status === "PENDING_PAYMENT";
  if (minutesUntilStart <= 30 && !vendorReleasingUnpaidSlot) {
    return response.status(409).json({
      message: "Appointments cannot be cancelled within 30 minutes of the start time.",
    });
  }

  const cancelled = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: { services: true, slots: true },
    });
    await transaction.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "CANCELLED",
        note: `Cancelled by ${actorId === appointment.customerId ? "customer" : "vendor"}`,
      },
    });
    return updated;
  });

  return response.json({ message: "Appointment cancelled.", appointment: cancelled });
});

app.post(
  "/api/appointments/:appointmentId/reschedule",
  requireAuth,
  requireVendor,
  [body("startsAt").isISO8601()],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a valid new appointment time.", errors: errors.array() });

    const appointment = await prisma.appointment.findUnique({
      where: { id: request.params.appointmentId },
      include: { services: true },
    });
    if (!appointment) return response.status(404).json({ message: "Appointment was not found." });
    if (appointment.vendorId !== request.user.sub) {
      return response.status(403).json({ message: "You cannot reschedule this appointment." });
    }
    if (!["CONFIRMED", "CHECKED_IN"].includes(appointment.status)) {
      return response.status(409).json({ message: "Only confirmed appointments can be rescheduled." });
    }

    const startsAt = new Date(request.body.startsAt);
    const durationMin = appointment.services.reduce((total, service) => total + service.durationMin, 0);
    const startLocal = getLagosDayAndMinutes(startsAt);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
    const endLocal = getLagosDayAndMinutes(endsAt);
    if (startsAt <= new Date() || startLocal.minutes % 30 !== 0 || durationMin % 30 !== 0 || startLocal.dayOfWeek !== endLocal.dayOfWeek) {
      return response.status(400).json({ message: "Choose a future 30-minute start that fits the appointment duration on one day." });
    }

    const availability = await prisma.availability.findMany({
      where: { vendorId: appointment.vendorId, dayOfWeek: startLocal.dayOfWeek, isActive: true },
    });
    const withinAvailability = availability.some((window) => {
      const [startHour, startMinute] = window.startTime.split(":").map(Number);
      const [endHour, endMinute] = window.endTime.split(":").map(Number);
      return startLocal.minutes >= startHour * 60 + startMinute && endLocal.minutes <= endHour * 60 + endMinute;
    });
    if (!withinAvailability) return response.status(409).json({ message: "The new time is outside your working hours." });

    const [blockout, conflict] = await Promise.all([
      prisma.blockoutDate.findFirst({ where: { vendorId: appointment.vendorId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
      prisma.appointmentSlot.findFirst({
        where: {
          appointmentId: { not: appointment.id },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          appointment: { vendorId: appointment.vendorId, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        },
      }),
    ]);
    if (blockout) return response.status(409).json({ message: "The new time overlaps a blocked period." });
    if (conflict) return response.status(409).json({ message: "The new time is already booked." });

    const slots = Array.from({ length: durationMin / 30 }, (_, index) => ({
      startsAt: new Date(startsAt.getTime() + index * 30 * 60000),
      endsAt: new Date(startsAt.getTime() + (index + 1) * 30 * 60000),
    }));
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.appointment.update({
        where: { id: appointment.id },
        data: { startAt: startsAt, endAt: endsAt },
      });
      await transaction.appointmentSlot.deleteMany({ where: { appointmentId: appointment.id } });
      await transaction.appointmentSlot.createMany({
        data: slots.map((slot) => ({ appointmentId: appointment.id, ...slot })),
      });
      await transaction.appointmentStatusHistory.create({
        data: {
          appointmentId: appointment.id,
          status: appointment.status,
          note: `Rescheduled by vendor to ${startsAt.toISOString()}`,
        },
      });
      return transaction.appointment.findUnique({
        where: { id: appointment.id },
        include: { services: true, slots: true },
      });
    });
    return response.json({ message: "Appointment rescheduled.", appointment: updated });
  },
);

app.post(
  "/api/vendor/appointments/manual",
  requireAuth,
  requireVendor,
  [
    body("customerEmail").trim().isEmail().normalizeEmail(),
    body("serviceId").isUUID(),
    body("startsAt").isISO8601(),
    body("notes").optional().isString().trim().isLength({ max: 500 }),
    body("depositCollectedOffline").optional().isBoolean(),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) return response.status(400).json({ message: "Provide a customer email, service, and appointment time.", errors: errors.array() });
    const [customer, business, service] = await Promise.all([
      prisma.user.findUnique({ where: { email: request.body.customerEmail }, select: { id: true, email: true, isActive: true } }),
      prisma.business.findFirst({ where: { ownerId: request.user.sub, isActive: true } }),
      prisma.service.findFirst({ where: { id: request.body.serviceId, isActive: true }, include: { business: true } }),
    ]);
    if (!customer || !customer.isActive) return response.status(404).json({ message: "No active customer account was found for that email." });
    if (!business) return response.status(404).json({ message: "Vendor business was not found." });
    if (!service || service.businessId !== business.id) return response.status(404).json({ message: "Choose an active service from your business." });
    if (customer.id === request.user.sub) return response.status(400).json({ message: "You cannot create a booking for yourself." });
    if (business.deliveryMode === "HOME_SERVICE_ONLY") return response.status(409).json({ message: "Manual bookings from this form are studio appointments, but your business currently only offers home service." });

    const startsAt = new Date(request.body.startsAt);
    const durationMin = service.durationMin;
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);
    const localStart = getLagosDayAndMinutes(startsAt);
    const localEnd = getLagosDayAndMinutes(endsAt);
    if (startsAt <= new Date() || localStart.minutes % 30 !== 0 || localStart.dayOfWeek !== localEnd.dayOfWeek) {
      return response.status(400).json({ message: "Choose a future 30-minute start time within a single Lagos calendar day." });
    }
    const availability = await prisma.availability.findMany({
      where: { vendorId: request.user.sub, dayOfWeek: localStart.dayOfWeek, isActive: true },
    });
    const withinAvailability = availability.some((window) => {
      const [startHour, startMinute] = window.startTime.split(":").map(Number);
      const [endHour, endMinute] = window.endTime.split(":").map(Number);
      return localStart.minutes >= startHour * 60 + startMinute && localEnd.minutes <= endHour * 60 + endMinute;
    });
    if (!withinAvailability) return response.status(409).json({ message: "The appointment is outside your working hours." });
    const [blockout, conflict] = await Promise.all([
      prisma.blockoutDate.findFirst({ where: { vendorId: request.user.sub, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
      prisma.appointmentSlot.findFirst({
        where: {
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
          appointment: { vendorId: request.user.sub, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        },
      }),
    ]);
    if (blockout) return response.status(409).json({ message: "The appointment overlaps a blocked period." });
    if (conflict) return response.status(409).json({ message: "The appointment time is already booked." });

    const subtotalKobo = service.priceKobo;
    const depositPercent = business.breakagePercent;
    const depositKobo = Math.round(subtotalKobo * depositPercent / 100);
    const vatKobo = Math.round(subtotalKobo * vatRatePercent / 100);
    const depositCollectedOffline = request.body.depositCollectedOffline === true;
    const appointment = await prisma.$transaction(async (transaction) => transaction.appointment.create({
      data: {
        customerId: customer.id,
        vendorId: request.user.sub,
        businessId: business.id,
        deliveryMode: "STUDIO",
        startAt: startsAt,
        endAt: endsAt,
        subtotalKobo,
        depositPercent,
        depositKobo,
        vatKobo,
        logisticsFeeKobo: 0,
        notes: request.body.notes?.trim() || null,
        status: depositCollectedOffline ? "CONFIRMED" : "PENDING_PAYMENT",
        services: { create: [{ serviceId: service.id, serviceName: service.name, durationMin, priceKobo: service.priceKobo }] },
        slots: { create: [{ startsAt, endsAt }] },
        statusHistory: { create: [{
          status: depositCollectedOffline ? "CONFIRMED" : "PENDING_PAYMENT",
          note: depositCollectedOffline ? "Manual appointment; deposit collected offline by vendor" : "Manual appointment awaiting deposit payment",
        }] },
        ...(depositCollectedOffline ? {
          payments: { create: {
            userId: customer.id,
            type: "DEPOSIT",
            status: "SUCCESSFUL",
            amountKobo: depositKobo + vatKobo,
            paidAt: new Date(),
            metadata: { collectionMethod: "OFFLINE_VENDOR_RECORDED" },
          } },
        } : {}),
      },
      include: { services: true, slots: true, customer: { select: { name: true, email: true } } },
    }));
    return response.status(201).json({ message: "Manual appointment created.", appointment });
  },
);

app.post("/api/appointments/:appointmentId/complete", requireAuth, requireVendor, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const actorId = request.user.sub;
  if (actorId !== appointment.vendorId) {
    return response.status(403).json({ message: "Only the service vendor can complete this appointment." });
  }

  if (!["CONFIRMED", "CHECKED_IN"].includes(appointment.status)) {
    return response.status(409).json({
      message: "Only confirmed or checked-in appointments can be completed.",
    });
  }

  const completed = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.appointment.update({
      where: { id: appointment.id },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { services: true, slots: true },
    });
    await transaction.appointmentStatusHistory.create({
      data: {
        appointmentId: appointment.id,
        status: "COMPLETED",
        note: "Marked complete by vendor",
      },
    });
    const capturedPayments = await transaction.payment.findMany({
      where: { appointmentId: appointment.id, type: { in: ["DEPOSIT", "BALANCE"] }, status: "SUCCESSFUL", amountKobo: { gt: 0 } },
      select: { id: true, amountKobo: true },
    });
    for (const payment of capturedPayments) {
      await postWalletTransaction(transaction, {
        userId: appointment.vendorId,
        mode: "VENDOR",
        type: "APPOINTMENT_EARNING",
        amountKobo: payment.amountKobo,
        sourceKey: `appointment-payment:${payment.id}`,
        description: "Captured appointment payment earned on completion",
        paymentId: payment.id,
      });
    }
    return updated;
  });

  return response.json({ message: "Appointment completed.", appointment: completed });
});

app.post(
  "/api/payments/appointments/:appointmentId/deposit",
  requireAuth,
  requireCustomerMode,
  async (request, response) => {
    const customerId = request.user.sub;
    const appointment = await prisma.appointment.findUnique({
      where: { id: request.params.appointmentId },
      include: { customer: true },
    });

    if (!appointment) {
      return response.status(404).json({ message: "Appointment was not found." });
    }
    if (appointment.customerId !== customerId) {
      return response.status(403).json({ message: "You cannot pay for this appointment." });
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return response.status(503).json({
        message: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to backend/.env.",
      });
    }

    if (appointment.status !== "PENDING_PAYMENT") {
      return response.status(409).json({ message: "This appointment is not awaiting deposit payment." });
    }

    const amountKobo = appointment.depositKobo + appointment.vatKobo + appointment.logisticsFeeKobo;

    let payment = await prisma.payment.findUnique({
      where: { appointmentId_type: { appointmentId: appointment.id, type: "DEPOSIT" } },
    });
    let ownsInitialization = false;

    if (!payment) {
      try {
        payment = await prisma.payment.create({
          data: {
            appointmentId: appointment.id,
            userId: customerId,
            type: "DEPOSIT",
            status: "INITIALIZED",
            amountKobo,
            paystackReference: randomUUID(),
          },
        });
        ownsInitialization = true;
      } catch (error) {
        if (error.code !== "P2002") throw error;
        payment = await prisma.payment.findUnique({
          where: { appointmentId_type: { appointmentId: appointment.id, type: "DEPOSIT" } },
        });
      }
    }

    if (payment?.status === "PENDING" && payment.paystackReference) {
      return response.json({
        message: "Deposit payment already initialized.",
        reference: payment.paystackReference,
        authorizationUrl: payment.metadata?.authorizationUrl,
        amountKobo: payment.amountKobo,
      });
    }

    if (!ownsInitialization && payment?.status === "INITIALIZED") {
      const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
      const reference = randomUUID();
      const claimed = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: "INITIALIZED",
          updatedAt: { lt: staleBefore },
        },
        data: { updatedAt: new Date(), paystackReference: reference },
      });
      ownsInitialization = claimed.count === 1;
      if (ownsInitialization) payment = { ...payment, paystackReference: reference };
    } else if (!ownsInitialization && payment?.status === "FAILED") {
      const reference = randomUUID();
      const claimed = await prisma.payment.updateMany({
        where: { id: payment.id, status: "FAILED" },
        data: {
          status: "INITIALIZED",
          amountKobo,
          paidAt: null,
          paystackReference: reference,
          updatedAt: new Date(),
        },
      });
      ownsInitialization = claimed.count === 1;
      if (ownsInitialization) payment = { ...payment, paystackReference: reference };
    }

    if (!ownsInitialization || !payment) {
      return response.status(409).json({ message: "Deposit payment initialization is already in progress." });
    }

    const callbackUrl = process.env.PAYSTACK_CALLBACK_URL
      ? new URL(process.env.PAYSTACK_CALLBACK_URL)
      : null;
    callbackUrl?.searchParams.set("appointmentId", appointment.id);

    let paystackResponse;
    let paystackResult;
    try {
      paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: appointment.customer.email,
          amount: amountKobo,
          currency: "NGN",
          reference: payment.paystackReference,
          metadata: { appointmentId: appointment.id, paymentType: "DEPOSIT" },
          ...(callbackUrl ? { callback_url: callbackUrl.toString() } : {}),
        }),
      });
      paystackResult = await paystackResponse.json();
    } catch {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", metadata: { error: "Paystack initialization request failed" } },
      });
      return response.status(502).json({ message: "Paystack could not initialize this payment." });
    }

    if (!paystackResponse.ok || !paystackResult.status || !paystackResult.data?.reference) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", metadata: { error: "Paystack rejected initialization" } },
      });
      return response.status(502).json({ message: "Paystack could not initialize this payment." });
    }

    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        paystackReference: paystackResult.data.reference,
        metadata: {
          accessCode: paystackResult.data.access_code,
          authorizationUrl: paystackResult.data.authorization_url,
        },
      },
    });

    return response.status(201).json({
      message: "Deposit payment initialized.",
      paymentId: payment.id,
      reference: paystackResult.data.reference,
      authorizationUrl: paystackResult.data.authorization_url,
      amountKobo,
    });
  },
);

app.post(
  "/api/payments/appointments/:appointmentId/verify",
  requireAuth,
  requireCustomerMode,
  async (request, response) => {
    const reference = String(request.body.reference || "").trim();
    if (!reference) {
      return response.status(400).json({ message: "A Paystack reference is required." });
    }
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return response.status(503).json({ message: "Paystack is not configured yet." });
    }

    const payment = await prisma.payment.findUnique({
      where: { paystackReference: reference },
      include: { appointment: true },
    });
    if (!payment || payment.appointmentId !== request.params.appointmentId || !payment.appointment) {
      return response.status(404).json({ message: "Deposit payment was not found." });
    }
    if (payment.userId !== request.user.sub || payment.appointment.customerId !== request.user.sub) {
      return response.status(403).json({ message: "You cannot verify this payment." });
    }
    if (payment.status === "SUCCESSFUL" && payment.appointment.status === "CONFIRMED") {
      return response.json({ message: "Appointment payment is already confirmed.", appointment: payment.appointment });
    }
    if (payment.appointment.status !== "PENDING_PAYMENT") {
      return response.status(409).json({ message: "This appointment is no longer awaiting payment." });
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
    );
    const verifyResult = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyResult.status || !verifyResult.data) {
      return response.status(502).json({ message: "Paystack could not verify this payment." });
    }

    const transaction = verifyResult.data;
    if (transaction.status !== "success") {
      if (["failed", "abandoned"].includes(transaction.status)) {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      }
      return response.status(409).json({ message: "Deposit payment has not succeeded." });
    }
    if (
      transaction.amount !== payment.amountKobo ||
      transaction.currency !== "NGN" ||
      transaction.metadata?.appointmentId !== payment.appointmentId
    ) {
      return response.status(400).json({ message: "Verified payment details do not match this appointment." });
    }

    const confirmedAppointment = await prisma.$transaction(async (transactionClient) => {
      const updated = await transactionClient.appointment.updateMany({
        where: { id: payment.appointmentId, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      });
      if (updated.count !== 1) return null;

      await transactionClient.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESSFUL", paidAt: new Date() },
      });
      await transactionClient.appointmentStatusHistory.create({
        data: {
          appointmentId: payment.appointmentId,
          status: "CONFIRMED",
          note: "Upfront deposit, VAT, and applicable logistics payment verified by Paystack",
        },
      });
      return transactionClient.appointment.findUnique({
        where: { id: payment.appointmentId },
        include: { services: true, slots: true },
      });
    });

    if (!confirmedAppointment) {
      return response.status(409).json({ message: "This appointment was released before payment confirmation." });
    }
    return response.json({ message: "Payment verified and appointment confirmed.", appointment: confirmedAppointment });
  },
);

app.post("/api/payments/appointments/:appointmentId/wallet", requireAuth, requireCustomerMode, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: request.params.appointmentId } });
  if (!appointment) return response.status(404).json({ message: "Appointment was not found." });
  if (appointment.customerId !== request.user.sub) return response.status(403).json({ message: "You cannot pay for this appointment." });
  if (appointment.status !== "PENDING_PAYMENT") return response.status(409).json({ message: "This appointment is not awaiting deposit payment." });
  const amountKobo = appointment.depositKobo + appointment.vatKobo + appointment.logisticsFeeKobo;
  const existingPayment = await prisma.payment.findUnique({ where: { appointmentId_type: { appointmentId: appointment.id, type: "DEPOSIT" } } });
  if (existingPayment && existingPayment.status !== "FAILED") {
    return response.status(409).json({ message: "A Paystack deposit attempt exists or is in progress. Finish or resolve it before choosing wallet payment." });
  }
  try {
    const settled = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.appointment.updateMany({
        where: { id: appointment.id, customerId: request.user.sub, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      });
      if (updated.count !== 1) throw new Error("WALLET_APPOINTMENT_STATE_CHANGED");
      let payment;
      if (existingPayment) {
        const changed = await transaction.payment.updateMany({
          where: { id: existingPayment.id, status: "FAILED" },
          data: { status: "SUCCESSFUL", amountKobo, paidAt: new Date(), paystackReference: null, metadata: { collectionMethod: "CUSTOMER_WALLET" } },
        });
        if (changed.count !== 1) throw new Error("WALLET_APPOINTMENT_STATE_CHANGED");
        payment = await transaction.payment.findUnique({ where: { id: existingPayment.id } });
      } else {
        payment = await transaction.payment.create({
          data: {
            appointmentId: appointment.id,
            userId: request.user.sub,
            type: "DEPOSIT",
            status: "SUCCESSFUL",
            amountKobo,
            paidAt: new Date(),
            metadata: { collectionMethod: "CUSTOMER_WALLET" },
          },
        });
      }
      await postWalletTransaction(transaction, {
        userId: request.user.sub,
        mode: "CUSTOMER",
        type: "APPOINTMENT_PAYMENT",
        amountKobo: -amountKobo,
        sourceKey: `wallet-appointment:${appointment.id}`,
        description: `Wallet deposit for appointment ${appointment.id.slice(0, 8)}`,
        paymentId: payment.id,
      });
      await transaction.appointmentStatusHistory.create({
        data: { appointmentId: appointment.id, status: "CONFIRMED", note: "Deposit, VAT, and applicable logistics paid from customer wallet" },
      });
      return transaction.appointment.findUnique({ where: { id: appointment.id }, include: { services: true, slots: true } });
    });
    return response.json({ message: "Appointment deposit paid with wallet funds.", appointment: settled });
  } catch (error) {
    if (error.message === "WALLET_INSUFFICIENT_BALANCE") return response.status(409).json({ message: "Wallet balance is insufficient for this appointment deposit." });
    if (error.message === "WALLET_APPOINTMENT_STATE_CHANGED") return response.status(409).json({ message: "Appointment payment state changed. Refresh and try again." });
    throw error;
  }
});

export default app;
