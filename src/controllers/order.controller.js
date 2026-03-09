const prisma = require("../utils/prisma");

// @POST /api/orders
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, shippingName, shippingPhone } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Order must have at least one item" });
    }
    if (!shippingAddress || !shippingName || !shippingPhone) {
      return res.status(400).json({ success: false, message: "Shipping name, address and phone are required" });
    }

    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const medicine = await prisma.medicine.findUnique({ where: { id: item.medicineId } });

      if (!medicine || !medicine.isAvailable) {
        return res.status(400).json({ success: false, message: `Medicine not available: ${item.medicineId}` });
      }
      if (medicine.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${medicine.name}". Available: ${medicine.stock}`,
        });
      }

      totalAmount += medicine.price * item.quantity;
      orderItems.push({ medicineId: item.medicineId, quantity: item.quantity, price: medicine.price });
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          totalAmount,
          shippingAddress,
          shippingName,
          shippingPhone,
          customerId: req.user.id,
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { medicine: { select: { id: true, name: true, image: true } } },
          },
        },
      });

      // Stock কমাও
      for (const item of orderItems) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Cart থেকে ordered items সরাও
      await tx.cart.deleteMany({
        where: {
          userId: req.user.id,
          medicineId: { in: orderItems.map((i) => i.medicineId) },
        },
      });

      return newOrder;
    });

    res.status(201).json({ success: true, message: "Order placed successfully", data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/orders
const getMyOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: {
        items: {
          include: {
            medicine: { select: { id: true, name: true, image: true, price: true } },
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

// @GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            medicine: { select: { id: true, name: true, image: true, price: true } },
          },
        },
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.customerId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.customerId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (order.status !== "PLACED") {
      return res.status(400).json({ success: false, message: "Only PLACED orders can be cancelled" });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: "CANCELLED" },
    });

    res.json({ success: true, message: "Order cancelled successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createOrder, getMyOrders, getOrder, cancelOrder };