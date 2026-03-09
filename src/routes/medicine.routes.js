const express = require("express");
const router = express.Router();
const { getMedicines, getMedicine, addReview } = require("../controllers/medicine.controller");
const { protect, authorize } = require("../middleware/auth.middleware");

router.get("/", getMedicines);
router.get("/:id", getMedicine);
router.post("/:id/reviews", protect, authorize("CUSTOMER"), addReview);

module.exports = router;