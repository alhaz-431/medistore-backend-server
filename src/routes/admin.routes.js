const express = require("express");
const router = express.Router();
const {
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
} = require("../controllers/admin.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.use(protect, authorize("ADMIN"));

router.get("/dashboard", getDashboardStats);

// Users
router.get("/users", getAllUsers);
router.patch("/users/:id", updateUserStatus);

// Orders
router.get("/orders", getAllOrders);

// Medicines
router.get("/medicines", getAllMedicines);
router.delete("/medicines/:id", deleteMedicine);

// Categories
router.get("/categories", getAllCategories);
router.post("/categories", createCategory);
router.put("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

module.exports = router;