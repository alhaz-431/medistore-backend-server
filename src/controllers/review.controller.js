const prisma = require("../prisma"); // আপনার প্রিজমা ক্লায়েন্ট পাথ অনুযায়ী

const createReview = async (req, res) => {
  const { medicineId, rating, comment } = req.body;
  const customerId = req.user.id; // মিডলওয়্যার থেকে ইউজার আইডি নেওয়া

  try {
    // একই ইউজার একই ওষুধে একবারই রিভিউ দিতে পারবে কিনা চেক (ঐচ্ছিক)
    const existingReview = await prisma.review.findFirst({
      where: { medicineId, customerId }
    });

    if (existingReview) {
      return res.status(400).json({ message: "আপনি ইতিমধ্যে এই ওষুধে রিভিউ দিয়েছেন।" });
    }

    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating),
        comment,
        medicineId,
        customerId
      }
    });

    res.status(201).json({ message: "রিভিউ সফলভাবে জমা হয়েছে!", review });
  } catch (error) {
    console.error("Review Error:", error);
    res.status(500).json({ message: "সার্ভার এরর, রিভিউ নেওয়া যায়নি।" });
  }
};

// কোনো নির্দিষ্ট ওষুধের সব রিভিউ দেখার জন্য (ঐচ্ছিক)
const getMedicineReviews = async (req, res) => {
  const { medicineId } = req.params;
  try {
    const reviews = await prisma.review.findMany({
      where: { medicineId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    });
    res.status(200).json(reviews);
  } catch (error) {
    res.status(500).json({ message: "রিভিউ লোড করা যায়নি।" });
  }
};

module.exports = { createReview, getMedicineReviews };