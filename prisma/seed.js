const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@medistore.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@medistore.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("✅ Admin seeded:", admin.email);

  const categories = [
    { name: "Pain Relief", slug: "pain-relief" },
    { name: "Cold & Flu", slug: "cold-flu" },
    { name: "Vitamins & Supplements", slug: "vitamins-supplements" },
    { name: "Digestive Health", slug: "digestive-health" },
    { name: "Allergy", slug: "allergy" },
    { name: "Skin Care", slug: "skin-care" },
    { name: "Eye Care", slug: "eye-care" },
    { name: "First Aid", slug: "first-aid" },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  console.log("✅ Categories seeded:", categories.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });