import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:promote -- existing-account@example.com");
  process.exitCode = 1;
} else {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: "ADMIN", activeMode: "ADMIN", isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });
    console.log(`Promoted ${user.email} to ADMIN. Sign in with the existing account credentials.`);
  } catch (error) {
    if (error.code === "P2025") {
      console.error(`No account exists for ${email}. Create the account first, then run this command again.`);
    } else {
      console.error("Could not promote account to ADMIN.");
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}