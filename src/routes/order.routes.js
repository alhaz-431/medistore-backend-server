const express = require("express");
const router = express.Router();
const { createOrder, getMyOrders, getOrder, cancelOrder } = require("../controllers/order.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect);

router.post("/", authorize("CUSTOMER"), createOrder);
router.get("/", authorize("CUSTOMER"), getMyOrders);
router.get("/:id", getOrder);
router.patch("/:id/cancel", authorize("CUSTOMER"), cancelOrder);

module.exports = router;