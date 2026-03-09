const express = require("express");
const router = express.Router();
const {
  addMedicine,
  getMyMedicines,
  updateMedicine,
  deleteMedicine,
  getSellerOrders,
  updateOrderStatus,
  getDashboardStats,
} = require("../controllers/seller.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect, authorize("SELLER"));

router.get("/dashboard", getDashboardStats);
router.get("/medicines", getMyMedicines);
router.post("/medicines", addMedicine);
router.put("/medicines/:id", updateMedicine);
router.delete("/medicines/:id", deleteMedicine);
router.get("/orders", getSellerOrders);
router.patch("/orders/:id", updateOrderStatus);

module.exports = router;