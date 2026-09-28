import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const vendorEmail = "demo.vendor@glamora.test";
const customerEmail = "demo.customer@glamora.test";

const nextMonday = () => {
  const date = new Date();
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

try {
  const passwordHash = await bcrypt.hash("DemoPassword123!", 12);
  const vendor = await prisma.user.upsert({
    where: { email: vendorEmail },
    update: { role: "VENDOR" },
    create: {
      name: "Demo Vendor",
      email: vendorEmail,
      passwordHash,
      role: "VENDOR",
    },
  });
  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { role: "CUSTOMER" },
    create: {
      name: "Demo Customer",
      email: customerEmail,
      passwordHash,
      role: "CUSTOMER",
    },
  });

  let business = await prisma.business.findFirst({ where: { ownerId: vendor.id } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        ownerId: vendor.id,
        name: "Glamora Demo Studio",
        description: "Development-only demo business",
        email: vendorEmail,
        deliveryMode: "BOTH",
        breakagePercent: 25,
        logisticsFeeKobo: 1500000,
      },
    });
  }

  const category = await prisma.serviceCategory.upsert({
    where: { name: "Hair Care" },
    update: {},
    create: { name: "Hair Care", description: "Demo service category" },
  });

  let service = await prisma.service.findFirst({
    where: { businessId: business.id, name: "Demo Precision Cut" },
  });
  if (!service) {
    service = await prisma.service.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        name: "Demo Precision Cut",
        description: "Development-only demo service",
        durationMin: 60,
        priceKobo: 1500000,
        depositPercent: 25,
      },
    });
  }

  const demoProducts = [
    {
      name: "Restorative Scalp & Hair Elixir (100ml)",
      category: "Hair Care",
      description: "Cold-pressed botanical extracts, organic rosemary and jojoba for deep follicle nourishment and moisture retention.",
      priceKobo: 1850000,
      discountPercent: 15,
      stockQuantity: 42,
      status: "ACTIVE",
    },
    {
      name: "Organic Bamboo Detangling Comb Set",
      category: "Accessories",
      description: "Dual-tooth anti-static design with linen travel pouch. Gentle on sensitive scalps and reduces breakage.",
      priceKobo: 650000,
      discountPercent: 0,
      stockQuantity: 15,
      status: "ACTIVE",
    },
    {
      name: "Hydrating Shea Butter Deep Mask (250g)",
      category: "Treatment",
      description: "Intense moisture infusion with pure raw West African shea butter, restoring elasticity to brittle hair strands.",
      priceKobo: 1400000,
      discountPercent: 0,
      stockQuantity: 88,
      status: "ACTIVE",
    },
    {
      name: "Clinical Clarifying Follicle Serum",
      category: "Scalp Therapy",
      description: "Salicylic acid 2%, tea tree oil, peptide scalp complex. Designed for clinical clarifying therapy.",
      priceKobo: 2400000,
      discountPercent: 15,
      stockQuantity: 0,
      status: "DRAFT",
    },
  ];

  for (const product of demoProducts) {
    const existingProduct = await prisma.product.findFirst({
      where: { businessId: business.id, name: product.name },
    });
    if (!existingProduct) {
      await prisma.product.create({
        data: {
          ...product,
          businessId: business.id,
        },
      });
    }
  }

  const availability = await prisma.availability.findFirst({
    where: { vendorId: vendor.id, dayOfWeek: 1, staffMemberId: null },
  });
  if (!availability) {
    await prisma.availability.create({
      data: {
        vendorId: vendor.id,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      },
    });
  }

  console.log(JSON.stringify({
    vendorId: vendor.id,
    customerId: customer.id,
    businessId: business.id,
    serviceId: service.id,
    bookingDate: nextMonday().toISOString().slice(0, 10),
    demoPassword: "DemoPassword123!",
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
