// require("dotenv").config();
// const express = require("express");
// const { PrismaClient } = require("@prisma/client");
// const { PrismaPg } = require("@prisma/adapter-pg");
// const { Pool } = require("pg");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const cors = require("cors");

// const app = express();

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// const adapter = new PrismaPg(pool);

// const prisma = new PrismaClient({ 
//   adapter,
//   transactionOptions: {
//     maxWait: 10000, 
//     timeout: 30000, 
//   }
// });

// app.use(express.json());
// app.use(cors());

// const JWT_SECRET = process.env.JWT_SECRET || "medistore-secret-123";

// app.get("/", (req, res) => {
//   res.json({ message: "MediStore API is running smoothly! 🚀" });
// });

// // --- ১. রেজিস্ট্রেশন (রোল সহ) ---
// app.post("/api/register", async (req, res) => {
//   try {
//     const { name, email, password, role } = req.body; // Role: CUSTOMER or SELLER
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const newUser = await prisma.user.create({
//       data: { name, email, password: hashedPassword, role: role || "CUSTOMER" },
//     });
//     res.status(201).json({ message: "Registration successful!", user: { id: newUser.id, name: newUser.name, role: newUser.role } });
//   } catch (error) {
//     res.status(500).json({ error: "Email already exists or Database error!" });
//   }
// });

// // --- ২. লগইন ---
// app.post("/api/login", async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const user = await prisma.user.findUnique({ where: { email } });
//     if (!user) return res.status(404).json({ error: "User not found!" });
//     if (user.isBanned) return res.status(403).json({ error: "Your account is banned! 🚫" });

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) return res.status(401).json({ error: "Invalid password!" });

//     const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
//     res.json({ 
//       message: "Login success!", 
//       token, 
//       user: { id: user.id, name: user.name, email: user.email, role: user.role } 
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৩. ক্যাটাগরি তৈরি ---
// app.post("/api/categories", async (req, res) => {
//   try {
//     const { name, slug } = req.body;
//     const newCategory = await prisma.category.create({ data: { name, slug } });
//     res.status(201).json(newCategory);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৪. মেডিসিন রাউট (Search & Filter সহ আপডেট করা) ---
// app.get("/api/medicines", async (req, res) => {
//   try {
//     const { search, category, minPrice, maxPrice, manufacturer } = req.query;

//     const medicines = await prisma.medicine.findMany({
//       where: {
//         AND: [
//           search ? { name: { contains: search, mode: "insensitive" } } : {},
//           category ? { category: { name: { contains: category, mode: "insensitive" } } } : {},
//           manufacturer ? { manufacturer: { contains: manufacturer, mode: "insensitive" } } : {},
//           minPrice ? { price: { gte: parseFloat(minPrice) } } : {},
//           maxPrice ? { price: { lte: parseFloat(maxPrice) } } : {},
//         ],
//       },
//       include: { category: true, seller: true },
//     });
//     res.json(medicines);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post("/api/medicines", async (req, res) => {
//   try {
//     const { name, price, stock, description, manufacturer, categoryId, sellerId, image } = req.body;
//     const newMedicine = await prisma.medicine.create({
//       data: { 
//         name, description, manufacturer, image,
//         price: parseFloat(price), 
//         stock: parseInt(stock),
//         category: { connect: { id: categoryId } },
//         seller: { connect: { id: sellerId } }
//       }
//     });
//     res.status(201).json(newMedicine);
//   } catch (error) {
//     res.status(500).json({ error: "মেডিসিন অ্যাড করা সম্ভব হয়নি।" });
//   }
// });

// // --- ৫. মেডিসিন আপডেট করা ---
// app.patch("/api/medicines/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const data = req.body;
//     const updatedMedicine = await prisma.medicine.update({
//       where: { id: id },
//       data: {
//         ...data,
//         price: data.price ? parseFloat(data.price) : undefined,
//         stock: data.stock ? parseInt(data.stock) : undefined,
//       }
//     });
//     res.json({ message: "Medicine updated! ✅", updatedMedicine });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৬. মেডিসিন ডিলিট করা ---
// app.delete("/api/medicines/:id", async (req, res) => {
//   try {
//     const { id } = req.params;
//     await prisma.medicine.delete({ where: { id: id } });
//     res.json({ message: "Medicine deleted successfully! 🗑️" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৭. নতুন অর্ডার তৈরি করা ---
// app.post("/api/orders", async (req, res) => {
//   try {
//     const { customerId, items, shippingAddress, shippingName, shippingPhone } = req.body;
//     const result = await prisma.$transaction(async (tx) => {
//       let calculatedTotal = 0;
//       const orderItemsData = [];
//       for (const item of items) {
//         const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
//         if (!medicine || medicine.stock < item.quantity) {
//           throw new Error(`${medicine?.name || "ওষুধ"} এর পর্যাপ্ত স্টক নেই!`);
//         }
//         calculatedTotal += medicine.price * item.quantity;
//         orderItemsData.push({ medicineId: item.medicineId, quantity: item.quantity, price: medicine.price });
//         await tx.medicine.update({
//           where: { id: item.medicineId },
//           data: { stock: { decrement: item.quantity } },
//         });
//       }
//       return await tx.order.create({
//         data: {
//           totalAmount: calculatedTotal,
//           shippingAddress, shippingName, shippingPhone, customerId,
//           items: { create: orderItemsData },
//         },
//       });
//     });
//     res.status(201).json({ message: "Order placed successfully! 📦", order: result });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৮. সব অর্ডারের লিস্ট দেখা ---
// app.get("/api/orders", async (req, res) => {
//   try {
//     const orders = await prisma.order.findMany({
//       include: { items: { include: { medicine: true } }, customer: true },
//       orderBy: { createdAt: 'desc' }
//     });
//     res.json(orders);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ৯. অর্ডারের স্ট্যাটাস আপডেট (Seller/Admin) ---
// app.patch("/api/orders/:id/status", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;
//     const updatedOrder = await prisma.order.update({
//       where: { id: id },
//       data: { status: status },
//     });
//     res.json({ message: `Order status updated to ${status}! 🚚`, updatedOrder });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ১০. সব ইউজার দেখা (Admin Only) ---
// app.get("/api/admin/users", async (req, res) => {
//   try {
//     const users = await prisma.user.findMany({
//       select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true }
//     });
//     res.json(users);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// // --- ১১. ইউজার ব্যান/আনব্যান করা ---
// app.patch("/api/admin/users/:id/status", async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { isBanned } = req.body;
//     const updatedUser = await prisma.user.update({
//       where: { id: id },
//       data: { isBanned: isBanned },
//     });
//     res.json({ message: isBanned ? "User banned! 🚫" : "User active! ✅", updatedUser });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));











require("dotenv").config();
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

// --- Database Connection (Verc-Friendly) ---
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

app.use(express.json());
app.use(cors());

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
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: role || "CUSTOMER" },
    });
    res.status(201).json({ message: "Registration successful!", user: { id: newUser.id, name: newUser.name, role: newUser.role } });
  } catch (error) {
    console.error("Reg Error:", error);
    if (error.code === 'P2002') return res.status(400).json({ error: "এই ইমেইলটি ইতিমধ্যে আছে!" });
    res.status(500).json({ error: "রেজিস্ট্রেশন ব্যর্থ হয়েছে।" });
  }
});

// --- ২. লগইন ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found!" });
    if (user.isBanned) return res.status(403).json({ error: "Your account is banned! 🚫" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid password!" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    res.json({ 
      message: "Login success!", 
      token, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৩. ক্যাটাগরি তৈরি ---
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
      data: { 
        name, description, manufacturer, image,
        price: parseFloat(price), 
        stock: parseInt(stock),
        category: { connect: { id: categoryId } },
        seller: { connect: { id: sellerId } }
      }
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
      data: {
        ...data,
        price: data.price ? parseFloat(data.price) : undefined,
        stock: data.stock ? parseInt(data.stock) : undefined,
      }
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

// --- ৮. নতুন অর্ডার তৈরি ---
app.post("/api/orders", async (req, res) => {
  try {
    const { customerId, items, shippingAddress, shippingName, shippingPhone } = req.body;
    const result = await prisma.$transaction(async (tx) => {
      let calculatedTotal = 0;
      const orderItemsData = [];
      for (const item of items) {
        const medicine = await tx.medicine.findUnique({ where: { id: item.medicineId } });
        if (!medicine || medicine.stock < item.quantity) {
          throw new Error(`${medicine?.name || "ওষুধ"} এর পর্যাপ্ত স্টক নেই!`);
        }
        calculatedTotal += medicine.price * item.quantity;
        orderItemsData.push({ medicineId: item.medicineId, quantity: item.quantity, price: medicine.price });
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      return await tx.order.create({
        data: {
          totalAmount: calculatedTotal,
          shippingAddress, shippingName, shippingPhone, customerId,
          items: { create: orderItemsData },
        },
      });
    });
    res.status(201).json({ message: "Order placed successfully! 📦", order: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ৯. সব অর্ডার দেখা ---
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: { include: { medicine: true } }, customer: true },
      orderBy: { createdAt: 'desc' }
    });
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
    const updatedOrder = await prisma.order.update({
      where: { id: id },
      data: { status: status },
    });
    res.json({ message: `Order status updated to ${status}! 🚚`, updatedOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ১১. অ্যাডমিন: সব ইউজার দেখা ---
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isBanned: true, createdAt: true }
    });
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
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { isBanned: isBanned },
    });
    res.json({ message: isBanned ? "User banned! 🚫" : "User active! ✅", updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));