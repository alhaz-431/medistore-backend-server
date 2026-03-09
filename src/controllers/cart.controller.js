const prisma = require("../utils/prisma");

// @GET /api/cart
const getCart = async (req, res) => {
  try {
    const cartItems = await prisma.cart.findMany({
      where: { userId: req.user.id },
      include: {
        medicine: {
          include: { category: { select: { name: true } } },
        },
      },
    });

    const total = cartItems.reduce(
      (sum, item) => sum + item.medicine.price * item.quantity,
      0
    );

    res.json({ success: true, data: cartItems, total: parseFloat(total.toFixed(2)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/cart
const addToCart = async (req, res) => {
  try {
    const { medicineId, quantity = 1 } = req.body;

    if (!medicineId) {
      return res.status(400).json({ success: false, message: "medicineId is required" });
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine || !medicine.isAvailable) {
      return res.status(404).json({ success: false, message: "Medicine not found or unavailable" });
    }

    if (medicine.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${medicine.stock} items in stock` });
    }

    const existing = await prisma.cart.findUnique({
      where: { userId_medicineId: { userId: req.user.id, medicineId } },
    });

    let cartItem;
    if (existing) {
      const newQty = existing.quantity + parseInt(quantity);
      if (medicine.stock < newQty) {
        return res.status(400).json({ success: false, message: `Only ${medicine.stock} items in stock` });
      }
      cartItem = await prisma.cart.update({
        where: { userId_medicineId: { userId: req.user.id, medicineId } },
        data: { quantity: newQty },
        include: { medicine: true },
      });
    } else {
      cartItem = await prisma.cart.create({
        data: { userId: req.user.id, medicineId, quantity: parseInt(quantity) },
        include: { medicine: true },
      });
    }

    res.status(201).json({ success: true, message: "Added to cart", data: cartItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/cart/:medicineId
const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const { medicineId } = req.params;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity must be at least 1" });
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (medicine.stock < quantity) {
      return res.status(400).json({ success: false, message: `Only ${medicine.stock} items in stock` });
    }

    const cartItem = await prisma.cart.update({
      where: { userId_medicineId: { userId: req.user.id, medicineId } },
      data: { quantity: parseInt(quantity) },
      include: { medicine: true },
    });

    res.json({ success: true, message: "Cart updated", data: cartItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/cart/:medicineId
const removeFromCart = async (req, res) => {
  try {
    await prisma.cart.delete({
      where: { userId_medicineId: { userId: req.user.id, medicineId: req.params.medicineId } },
    });
    res.json({ success: true, message: "Removed from cart" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @DELETE /api/cart/clear
const clearCart = async (req, res) => {
  try {
    await prisma.cart.deleteMany({ where: { userId: req.user.id } });
    res.json({ success: true, message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };