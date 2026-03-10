require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

// --- Database Connection ---
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ 
  adapter,
  transactionOptions: {
    maxWait: 10000, 
    timeout: 30000, 
  }
});

// --- CORS Config (এটি আপনার রেজিস্ট্রেশন এরর ফিক্স করবে) ---
app.use(cors({
  origin: ["https://medistore-client-seven.vercel.app", "http://localhost:3000"],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true
}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "medistore-secret-123";

app.get("/", (req, res) => {
  res.json({ message: "MediStore API is running smoothly! 🚀" });
});

// --- ১. রেজিস্ট্রেশন ---
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "সবগুলো ঘর পূরণ করুন!" });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "এই ইমেইলটি ইতিমধ্যে আছে!" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || "CUSTOMER" },
    });
    res.status(201).json({ message: "Registration successful!", user: { id: newUser.id, name: newUser.name, role: newUser.role } });
  } catch (error) {
    res.status(500).json({ error: "রেজিস্ট্রেশন ব্যর্থ হয়েছে।" });
  }
});

// --- ২. লগইন ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "ইউজার পাওয়া যায়নি!" });
    if (user.isBanned) return res.status(403).json({ error: "অ্যাকাউন্টটি ব্যান করা হয়েছে!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "ভুল পাসওয়ার্ড!" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login success!", token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৩. ক্যাটাগরি ---
app.post("/api/categories", async (req, res) => {
  try {
    const { name, slug } = req.body;
    const newCategory = await prisma.category.create({ data: { name, slug } });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৪. মেডিসিন লিস্ট (Search & Filter) ---
app.get("/api/medicines", async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, manufacturer } = req.query;
    const medicines = await prisma.medicine.findMany({
      where: {
        AND: [
          search ? { name: { contains: search, mode: "insensitive" } } : {},
          category ? { category: { name: { contains: category, mode: "insensitive" } } } : {},
          manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" } } : {},
          minPrice ? { price: { gte: parseFloat(minPrice) } } : {},
          maxPrice ? { price: { lte: parseFloat(maxPrice) } } : {},
        ],
      },
      include: { category: true, seller: true },
    });
    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৫. মেডিসিন অ্যাড ---
app.post("/api/medicines", async (req, res) => {
  try {
    const { name, price, stock, description, manufacturer, categoryId, sellerId, image } = req.body;
    const newMedicine = await prisma.medicine.create({
      data: { name, description, manufacturer, image, price: parseFloat(price), stock: parseInt(stock), category: { connect: { id: categoryId } }, seller: { connect: { id: sellerId } } }
    });
    res.status(201).json(newMedicine);
  } catch (error) {
    res.status(500).json({ error: "মেডিসিন অ্যাড করা সম্ভব হয়নি।" });
  }
});

// --- ৬. মেডিসিন আপডেট ---
app.patch("/api/medicines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updatedMedicine = await prisma.medicine.update({
      where: { id: id },
      data: { ...data, price: data.price ? parseFloat(data.price) : undefined, stock: data.stock ? parseInt(data.stock) : undefined }
    });
    res.json({ message: "Medicine updated! ✅", updatedMedicine });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৭. মেডিসিন ডিলিট ---
app.delete("/api/medicines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.medicine.delete({ where: { id: id } });
    res.json({ message: "Medicine deleted successfully! 🗑️" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৮. নতুন অর্ডার ---
app.post("/api/orders", async (req, res) => {
  try {
    const { customerId, items, shippingAddress, shippingName, shippingPhone } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const orderItemsData = [];
      for (const item of items) {
        const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
        if (!medicine || medicine.stock < item.quantity) throw new Error(`${medicine?.name} স্টক নেই!`);
        calculatedTotal += medicine.price * item.quantity;
        orderItemsData.push({ medicineId: item.medicineId, quantity: item.quantity, price: medicine.price });
        await tx.medicine.update({ where: { id: item.medicineId }, data: { stock: { decrement: item.quantity } } });
      }
      return await tx.order.create({
        data: { totalAmount: calculatedTotal, shippingAddress, shippingName, shippingPhone, customerId, items: { create: orderItemsData } }
      });
    });
    res.status(201).json({ message: "Order placed! 📦", order: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৯. অর্ডার লিস্ট ---
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ include: { items: { include: { medicine: true } }, customer: true }, orderBy: { createdAt: 'desc' } });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১০. অর্ডার স্ট্যাটাস আপডেট ---
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedOrder = await prisma.order.update({ where: { id: id }, data: { status: status } });
    res.json({ message: `Status updated to ${status}! 🚚`, updatedOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১১. অ্যাডমিন: সব ইউজার ---
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১২. ইউজার ব্যান/আনব্যান ---
app.patch("/api/admin/users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { isBanned } = req.body;
    const updatedUser = await prisma.user.update({ where: { id: id }, data: { isBanned: isBanned } });
    res.json({ message: isBanned ? "User banned! 🚫" : "User active! ✅", updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));