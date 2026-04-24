require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

// --- ১. Database Connection ---
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ 
  adapter,
  transactionOptions: {
    maxWait: 10000, 
    timeout: 30000, 
  }
});

// --- ২. CORS Config ---
app.use(cors({
  origin: ["https://medistore-client-seven.vercel.app", "http://localhost:3000"],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true
}));

app.use(express.json());
const JWT_SECRET = process.env.JWT_SECRET || "medistore-secret-123";

// --- ৩. অথেনটিকেশন মিডলওয়্যার (verifyToken) ---
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "টোকেন পাওয়া যায়নি!" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ error: "ইনভ্যালিড টোকেন!" });
  }
};

// --- ৪. হোম রাউট ---
app.get("/", (req, res) => {
  res.json({ message: "MediStore API is running smoothly! 🚀" });
});

// --- ৫. রেজিস্ট্রেশন ---
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "সবগুলো ঘর পূরণ করুন!" });
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

// --- ৬. লগইন ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "ইউজার পাওয়া যায়নি!" });
    if (user.isBanned) return res.status(403).json({ error: "অ্যাকাউন্টটি ব্যান করা হয়েছে!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "ভুল পাসওয়ার্ড!" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login success!", token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৭. ক্যাটাগরি অ্যাড & লিস্ট ---
app.post("/api/categories", async (req, res) => {
  try {
    const { name, slug } = req.body;
    const newCategory = await prisma.category.create({ data: { name, slug } });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "ক্যাটাগরি ডাটা পাওয়া যায়নি" });
  }
});

// --- ৮. মেডিসিন লিস্ট (সার্চ & ফিল্টার) ---
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

// --- ৯. মেডিসিন অ্যাড, আপডেট & ডিলিট ---
app.post("/api/medicines", async (req, res) => {
  try {
    const { name, price, stock, description, manufacturer, categoryId, sellerId } = req.body;
    const newMedicine = await prisma.medicine.create({
      data: { name, description: description || "No description provided", price: parseFloat(price), stock: parseInt(stock), manufacturer, categoryId, sellerId },
    });
    res.status(201).json({ success: true, data: newMedicine });
  } catch (error) {
    res.status(500).json({ error: "মেডিসিন সেভ হতে পারেনি" });
  }
});

app.patch("/api/medicines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await prisma.medicine.update({
      where: { id },
      data: { ...data, price: data.price ? parseFloat(data.price) : undefined, stock: data.stock ? parseInt(data.stock) : undefined }
    });
    res.json({ message: "Medicine updated!", updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/medicines/:id", async (req, res) => {
  try {
    await prisma.medicine.delete({ where: { id: req.params.id } });
    res.json({ message: "Medicine deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১০. নতুন অর্ডার প্লেস করা ---
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
    res.status(201).json({ message: "Order placed!", order: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১১. কাস্টমারের নিজের অর্ডার (my-orders) [CRITICAL ORDER] ---
app.get("/api/orders/my-orders", verifyToken, async (req, res) => {
  try {
    const customerId = req.user.id;
    const orders = await prisma.order.findMany({
      where: { customerId: customerId },
      include: { items: { include: { medicine: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "অর্ডার হিস্ট্রি পাওয়া যায়নি" });
  }
});

// --- ১২. সব অর্ডার লিস্ট (Admin Only) ---
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ include: { items: { include: { medicine: true } }, customer: true }, orderBy: { createdAt: 'desc' } });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১৩. নির্দিষ্ট অর্ডারের ডিটেইলস (:id) ---
app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { items: { include: { medicine: true } } } });
    if (!order) return res.status(404).json({ error: "অর্ডার পাওয়া যায়নি" });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১৪. অর্ডার স্ট্যাটাস & ইউজার ম্যানেজমেন্ট ---
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const updated = await prisma.order.update({ where: { id: req.params.id }, data: { status: req.body.status } });
    res.json({ message: "Status updated!", updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true } });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/admin/users/:id/status", async (req, res) => {
  try {
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isBanned: req.body.isBanned } });
    res.json({ message: "User status updated!", updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১৫. রিভিউ (পোস্ট & গেট) ---
app.post("/api/reviews", verifyToken, async (req, res) => {
  try {
    const { medicineId, rating, comment } = req.body;
    const existing = await prisma.review.findFirst({ where: { medicineId, customerId: req.user.id } });
    if (existing) return res.status(400).json({ error: "ইতিমধ্যে রিভিউ দিয়েছেন" });
    const review = await prisma.review.create({ data: { rating: parseInt(rating), comment: comment || "", medicineId, customerId: req.user.id } });
    res.status(201).json({ message: "রিভিউ সফল!", data: review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews/:medicineId", async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({ where: { medicineId: req.params.medicineId }, include: { customer: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "রিভিউ পাওয়া যায়নি" });
  }
});

// --- ১৬. অ্যাডমিন স্ট্যাটিস্টিকস ---
app.get("/api/admin/stats", async (req, res) => {
  try {
    const totalSales = await prisma.order.aggregate({ _sum: { totalAmount: true } });
    const totalOrders = await prisma.order.count();
    const totalUsers = await prisma.user.count();
    const lowStock = await prisma.medicine.count({ where: { stock: { lt: 5 } } });
    res.json({ totalRevenue: totalSales._sum.totalAmount || 0, totalOrders, totalUsers, lowStockCount: lowStock });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));