const jwt = require("jsonwebtoken");
const prisma = require("../utils/prisma");

const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check Authorization header (Bearer token - Postman এর জন্য)
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    // 2. Check cookie (Browser/Frontend এর জন্য)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true, isBanned: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: "Your account has been banned" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize };