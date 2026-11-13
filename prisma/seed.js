const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", name: "Administrator", passwordHash: hash, role: "ADMIN" },
  });
  console.log("Seeded admin user: admin / admin123");
}

main().catch(e=>{console.error(e);process.exit(1)}).finally(() => prisma.$disconnect());
