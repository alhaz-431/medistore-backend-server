require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
// ১. প্রিজমা ক্লায়েন্ট ইমপোর্ট করা
const { PrismaClient } = require("@prisma/client");

const app = express();
// ২. প্রিজমা অবজেক্ট তৈরি করা
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

// middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// test route
app.get("/", (req, res) => {
  res.json({ message: "MediStore API is running 💊", status: "OK" });
});

// ৩. নতুন ইউজার রেজিস্ট্রেশন রাউট (ডাটাবেস টেস্ট করার জন্য)
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // প্রিজমার মাধ্যমে ডাটাবেসে ইউজার সেভ করা
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password, // মনে রাখবেন: পরে এটি bcrypt দিয়ে এনক্রিপ্ট করতে হবে
      },
    });

    res.status(201).json({
      message: "User created in Neon DB! 🎉",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// server start logic
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 MediStore server running on port ${PORT}`);
  });
}

module.exports = app;
