const prisma = require("../utils/prisma");

// @POST /api/seller/medicines
const addMedicine = async (req, res) => {
  try {
    const { name, description, price, stock, image, manufacturer, dosage, categoryId } = req.body;

    if (!name || !description || !price || !manufacturer || !categoryId) {
      return res.status(400).json({ success: false, message: "Name, description, price, manufacturer and category are required" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const medicine = await prisma.medicine.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock) || 0,
        image,
        manufacturer,
        dosage,
        categoryId,
        sellerId: req.user.id,
      },
      include: { category: true },
    });

    res.status(201).json({ success: true, message: "Medicine added successfully", data: medicine });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/seller/medicines
const getMyMedicines = async (req, res) => {
  try {
    const medicines = await prisma.medicine.findMany({
      where: { sellerId: req.user.id },
      include: {
        category: true,
        _count: { select: { reviews: true, orderItems: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: medicines });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PUT /api/seller/medicines/:id
const updateMedicine = async (req, res) => {
  try {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });

    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }
    if (medicine.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only update your own medicines" });
    }

    const { name, description, price, stock, image, manufacturer, dosage, categoryId, isAvailable } = req.body;

    const updated = await prisma.medicine.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        price: price ? parseFloat(price) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        image,
        manufacturer,
        dosage,
        categoryId,
        isAvailable,
      },
      include: { category: true },
    });

    res.json({ success: true, message: "Medicine updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/seller/medicines/:id
const deleteMedicine = async (req, res) => {
  try {
    const medicine = await prisma.medicine.findUnique({ where: { id: req.params.id } });

    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }
    if (medicine.sellerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "You can only delete your own medicines" });
    }

    await prisma.medicine.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: "Medicine deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/seller/orders
const getSellerOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        items: { some: { medicine: { sellerId: req.user.id } } },
      },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        items: {
          include: {
            medicine: { select: { id: true, name: true, price: true, sellerId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/seller/orders/:id
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["PROCESSING", "SHIPPED", "DELIVERED"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Use: PROCESSING, SHIPPED, DELIVERED" });
    }

    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { medicine: true } } },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const hasSellersItem = order.items.some((item) => item.medicine.sellerId === req.user.id);
    if (!hasSellersItem) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ success: true, message: "Order status updated", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/seller/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const totalMedicines = await prisma.medicine.count({ where: { sellerId: req.user.id } });

    const orders = await prisma.order.findMany({
      where: { items: { some: { medicine: { sellerId: req.user.id } } } },
    });

    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "PLACED").length;
    const totalRevenue = orders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      success: true,
      data: { totalMedicines, totalOrders, pendingOrders, totalRevenue },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addMedicine,
  getMyMedicines,
  updateMedicine,
  deleteMedicine,
  getSellerOrders,
  updateOrderStatus,
  getDashboardStats,
};