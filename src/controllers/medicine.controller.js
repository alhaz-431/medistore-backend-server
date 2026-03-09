const prisma = require("../utils/prisma");

// @GET /api/medicines
const getMedicines = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1, limit = 12, sortBy = "createdAt", order = "desc" } = req.query;

    const where = { isAvailable: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { manufacturer: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = { slug: category };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    const validSortFields = ["price", "createdAt", "name"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortOrder = order === "asc" ? "asc" : "desc";

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await prisma.medicine.count({ where });

    const medicines = await prisma.medicine.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { id: true, name: true } },
        reviews: { select: { rating: true } },
      },
      skip,
      take: parseInt(limit),
      orderBy: { [sortField]: sortOrder },
    });

    const medicinesWithRating = medicines.map((m) => {
      const avgRating = m.reviews.length
        ? m.reviews.reduce((sum, r) => sum + r.rating, 0) / m.reviews.length
        : 0;
      const { reviews, ...rest } = m;
      return { ...rest, avgRating: parseFloat(avgRating.toFixed(1)), reviewCount: reviews.length };
    });

    res.json({
      success: true,
      data: medicinesWithRating,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/medicines/:id
const getMedicine = async (req, res) => {
  try {
    const medicine = await prisma.medicine.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        seller: { select: { id: true, name: true, email: true } },
        reviews: {
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    const avgRating = medicine.reviews.length
      ? medicine.reviews.reduce((sum, r) => sum + r.rating, 0) / medicine.reviews.length
      : 0;

    res.json({
      success: true,
      data: { ...medicine, avgRating: parseFloat(avgRating.toFixed(1)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/medicines/:id/reviews
const addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const medicineId = req.params.id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const medicine = await prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) {
      return res.status(404).json({ success: false, message: "Medicine not found" });
    }

    const hasOrdered = await prisma.orderItem.findFirst({
      where: {
        medicineId,
        order: { customerId: req.user.id, status: "DELIVERED" },
      },
    });

    if (!hasOrdered) {
      return res.status(403).json({ success: false, message: "You can only review medicines you have purchased and received" });
    }

    const existing = await prisma.review.findFirst({
      where: { medicineId, customerId: req.user.id },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already reviewed this medicine" });
    }

    const review = await prisma.review.create({
      data: { rating: parseInt(rating), comment, medicineId, customerId: req.user.id },
      include: { customer: { select: { id: true, name: true } } },
    });

    res.status(201).json({ success: true, message: "Review added successfully", data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMedicines, getMedicine, addReview };