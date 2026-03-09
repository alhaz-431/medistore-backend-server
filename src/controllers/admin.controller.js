const prisma = require("../utils/prisma");

// @GET /api/admin/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const [totalCustomers, totalSellers, totalMedicines, totalOrders, revenueData, recentOrders] =
      await Promise.all([
        prisma.user.count({ where: { role: "CUSTOMER" } }),
        prisma.user.count({ where: { role: "SELLER" } }),
        prisma.medicine.count(),
        prisma.order.count(),
        prisma.order.aggregate({
          where: { status: "DELIVERED" },
          _sum: { totalAmount: true },
        }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { customer: { select: { name: true, email: true } } },
        }),
      ]);

    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalSellers,
        totalMedicines,
        totalOrders,
        totalRevenue: revenueData._sum.totalAmount || 0,
        ordersByStatus,
        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const where = {};

    if (role) where.role = role.toUpperCase();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true,
        role: true, isBanned: true, createdAt: true,
        _count: { select: { orders: true, medicines: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/admin/users/:id
const updateUserStatus = async (req, res) => {
  try {
    const { isBanned } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role === "ADMIN") {
      return res.status(400).json({ success: false, message: "Cannot ban an admin" });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned },
      select: { id: true, name: true, email: true, role: true, isBanned: true },
    });

    res.json({
      success: true,
      message: isBanned ? "User banned successfully" : "User unbanned successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/admin/orders
const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const where = status ? { status: status.toUpperCase() } : {};

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        items: {
          include: { medicine: { select: { id: true, name: true, price: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/admin/medicines
const getAllMedicines = async (req, res) => {
  try {
    const medicines = await prisma.medicine.findMany({
      include: {
        category: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true, email: true } },
        _count: { select: { reviews: true, orderItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/admin/medicines/:id
const deleteMedicine = async (req, res) => {
  try {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });
    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    await prisma.medicine.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Medicine deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/admin/categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { medicines: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/admin/categories
const createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: "Name and slug are required" });
    }

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category with this slug already exists" });
    }

    const category = await prisma.category.create({ data: { name, slug } });
    res.status(201).json({ success: true, message: "Category created", data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/admin/categories/:id
const updateCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: { name, slug },
    });
    res.json({ success: true, message: "Category updated", data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/admin/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllOrders,
  getAllMedicines,
  deleteMedicine,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};