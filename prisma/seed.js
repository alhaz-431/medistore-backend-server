const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// সাধারণ কানেকশনের জন্য এটিই যথেষ্ট
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding started...");
  
  const hashedPassword = await bcrypt.hash("admin123", 10);

  // ১. অ্যাডমিন ইউজার তৈরি
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

  // ২. ক্যাটাগরিগুলো তৈরি
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

  console.log("✅ All categories seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });