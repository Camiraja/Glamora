import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { body, validationResult } from "express-validator";
import prisma from "./lib/prisma.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);
const vatRatePercent = Number(process.env.VAT_RATE_PERCENT ?? 0);

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
  verify(request, response, buffer) {
    request.rawBody = Buffer.from(buffer);
  },
}));

function requireVendor(request, response, next) {
  if (request.user.role !== "VENDOR") {
    return response.status(403).json({ message: "Vendor access is required." });
  }
  return next();
}

app.get("/api/health", (request, response) => {
  response.json({
    status: "ok",
    message: "Glamora backend is running",
  });
});

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
    include: { appointment: true },
  });
  if (!payment || payment.type !== "DEPOSIT" || !payment.appointment) {
    return response.status(404).json({ message: "Deposit payment was not found." });
  }
  if (event.event === "charge.failed") {
    if (
      transaction.amount !== payment.amountKobo ||
      transaction.currency !== "NGN" ||
      transaction.metadata?.appointmentId !== payment.appointmentId
    ) {
      return response.status(400).json({ message: "Webhook payment details do not match the initialized deposit." });
    }
    await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ["INITIALIZED", "PENDING"] } },
      data: { status: "FAILED" },
    });
    return response.status(200).json({ message: "Failed payment recorded; appointment remains pending." });
  }
  if (
    transaction.status !== "success" ||
    transaction.amount !== payment.amountKobo ||
    transaction.currency !== "NGN" ||
    transaction.metadata?.appointmentId !== payment.appointmentId
  ) {
    return response.status(400).json({ message: "Webhook payment details do not match the initialized deposit." });
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
  [
    body("name").trim().isLength({ min: 2, max: 80 }),
    body("email").trim().isEmail().normalizeEmail(),
    body("password").isLength({ min: 8, max: 72 }),
    body("role").isIn(["CUSTOMER", "VENDOR"]),
  ],
  async (request, response) => {
    const errors = validationResult(request);

    if (!errors.isEmpty()) {
      return response.status(400).json({
        message: "Please provide a valid name, email, password, and role.",
        errors: errors.array(),
      });
    }

    const { name, email, password, role } = request.body;
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
      },
    });

    return response.status(201).json({
      message: "Account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  },
);

app.post(
  "/api/auth/login",
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

    const token = jwt.sign(
      { sub: user.id, role: user.role },
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
      },
    });
  },
);

app.get("/api/users/me", requireAuth, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    return response.status(404).json({ message: "User was not found." });
  }

  return response.json({ user });
});

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
          staffMemberId: true,
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
      staffMemberId: true,
      name: true,
      description: true,
      durationMin: true,
      priceKobo: true,
      depositPercent: true,
      category: { select: { name: true } },
    },
  },
};

app.get("/api/businesses", async (request, response) => {
  const businesses = await prisma.business.findMany({
    where: { isActive: true, services: { some: { isActive: true } } },
    orderBy: { name: "asc" },
    select: publicBusinessSelect,
  });

  return response.json({ businesses, vatRatePercent });
});

app.get("/api/businesses/:businessId", async (request, response) => {
  const business = await prisma.business.findFirst({
    where: { id: request.params.businessId, isActive: true },
    select: publicBusinessSelect,
  });

  if (!business) {
    return response.status(404).json({ message: "Business was not found." });
  }

  return response.json({ business });
});

app.get("/api/vendor/business", requireAuth, requireVendor, async (request, response) => {
  const business = await prisma.business.findFirst({
    where: { ownerId: request.user.sub },
    select: {
      id: true,
      name: true,
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
    body("deliveryMode").isIn(["STUDIO_ONLY", "HOME_SERVICE_ONLY", "BOTH"]),
    body("breakagePercent").isInt({ min: 20, max: 30 }),
    body("logisticsFeeKobo").isInt({ min: 0 }),
  ],
  async (request, response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({
        message: "Choose a delivery mode, a 20–30% breakage rate, and a nonnegative logistics fee.",
        errors: errors.array(),
      });
    }

    const business = await prisma.business.findFirst({
      where: { ownerId: request.user.sub },
    });
    if (!business) {
      return response.status(404).json({ message: "Vendor business was not found." });
    }

    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        deliveryMode: request.body.deliveryMode,
        breakagePercent: Number(request.body.breakagePercent),
        logisticsFeeKobo: Number(request.body.logisticsFeeKobo),
      },
      select: {
        id: true,
        name: true,
        deliveryMode: true,
        breakagePercent: true,
        logisticsFeeKobo: true,
      },
    });

    return response.json({ business: updatedBusiness });
  },
);

app.get("/api/products", async (request, response) => {
  const category = String(request.query.category || "").trim();
  const search = String(request.query.search || "").trim();
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      business: { isActive: true },
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    include: { business: { select: { id: true, name: true, owner: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ products });
});

app.get("/api/products/:productId", async (request, response) => {
  const product = await prisma.product.findFirst({
    where: { id: request.params.productId, status: "ACTIVE", business: { isActive: true } },
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
  "/api/appointments",
  requireAuth,
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

    const staffIds = new Set(
      services.map((service) => service.staffMemberId).filter(Boolean),
    );
    if (staffIds.size > 1) {
      return response.status(400).json({
        message: "Services in one appointment must use the same staff member.",
      });
    }

    const staffMemberId = services[0].staffMemberId ?? null;
    const dayOfWeek = slotValues[0].startsAt.getUTCDay();
    const sameDay = slotValues.every(
      (slot) => slot.startsAt.getUTCDay() === dayOfWeek,
    );
    if (!sameDay) {
      return response.status(400).json({
        message: "All selected slots must be on the same day.",
      });
    }

    const availability = await prisma.availability.findMany({
      where: {
        vendorId,
        staffMemberId,
        dayOfWeek,
        isActive: true,
      },
    });
    const toMinutes = (date) => date.getUTCHours() * 60 + date.getUTCMinutes();
    const slotWithinAvailability = slotValues.every((slot) => {
      const start = toMinutes(slot.startsAt);
      const end = toMinutes(slot.endsAt);
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
        ...(staffMemberId ? { OR: [{ staffMemberId }, { staffMemberId: null }] } : {}),
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
        staffMemberId,
        startsAt: { lt: appointmentEnd },
        endsAt: { gt: appointmentStart },
        appointment: {
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
          staffMemberId,
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
              depositPercent,
            })),
          },
          slots: {
            create: slotValues.map((slot) => ({
              staffMemberId,
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

app.get("/api/appointments", requireAuth, async (request, response) => {
  const userId = request.user.sub;
  const appointments = await prisma.appointment.findMany({
    where: {
      ...(request.user.role === "VENDOR"
        ? { vendorId: userId }
        : { customerId: userId }),
    },
    include: {
      services: true,
      slots: true,
      ...(request.user.role === "CUSTOMER"
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
      ...(request.user.role === "VENDOR"
        ? { customer: { select: { id: true, name: true, email: true } } }
        : {}),
    },
    orderBy: { startAt: "asc" },
  });

  return response.json({ appointments });
});

app.get("/api/appointments/:appointmentId", requireAuth, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
    include: { services: true, slots: true, statusHistory: true },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const canAccess =
    appointment.customerId === request.user.sub ||
    appointment.vendorId === request.user.sub;
  if (!canAccess) {
    return response.status(403).json({ message: "You cannot access this appointment." });
  }

  return response.json({ appointment });
});

app.post("/api/appointments/:appointmentId/cancel", requireAuth, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const actorId = request.user.sub;
  if (actorId !== appointment.customerId && actorId !== appointment.vendorId) {
    return response.status(403).json({ message: "You cannot cancel this appointment." });
  }

  if (["CANCELLED", "COMPLETED", "NO_SHOW"].includes(appointment.status)) {
    return response.status(409).json({ message: "This appointment cannot be cancelled." });
  }

  const minutesUntilStart = (appointment.startAt.getTime() - Date.now()) / 60000;
  const vendorReleasingUnpaidSlot =
    actorId === appointment.vendorId && appointment.status === "PENDING_PAYMENT";
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

app.post("/api/appointments/:appointmentId/complete", requireAuth, async (request, response) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: request.params.appointmentId },
  });

  if (!appointment) {
    return response.status(404).json({ message: "Appointment was not found." });
  }

  const staffMember = appointment.staffMemberId
    ? await prisma.staffMember.findUnique({ where: { id: appointment.staffMemberId } })
    : null;
  const actorId = request.user.sub;
  const isAssignedStaff = staffMember?.userId === actorId;
  if (actorId !== appointment.vendorId && !isAssignedStaff) {
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
    return updated;
  });

  return response.json({ message: "Appointment completed.", appointment: completed });
});

app.post(
  "/api/payments/appointments/:appointmentId/deposit",
  requireAuth,
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

export default app;
