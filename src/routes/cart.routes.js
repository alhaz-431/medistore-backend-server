const express = require("express");
const router = express.Router();
const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require("../controllers/cart.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect, authorize("CUSTOMER"));

router.get("/", getCart);
router.post("/", addToCart);
router.patch("/:medicineId", updateCartItem);
router.delete("/clear", clearCart);
router.delete("/:medicineId", removeFromCart);

module.exports = router;