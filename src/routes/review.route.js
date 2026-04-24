const express = require("express");
const router = express.Router();
const { createReview, getMedicineReviews } = require("../controllers/review.controller");
const verifyToken = require("../middleware/verifyToken"); // আপনার অথেনটিকেশন মিডলওয়্যার

// রিভিউ পোস্ট করা (লগইন করা ইউজার লাগবে)
router.post("/", verifyToken, createReview);

// ওষুধের রিভিউ দেখা (পাবলিক)
router.get("/:medicineId", getMedicineReviews);

module.exports = router;