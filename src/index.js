require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// test route
app.get("/", (req, res) => {
  res.json({ message: "MediStore API is running 💊", status: "OK" });
});

// server start logic
const PORT = process.env.PORT || 5000;

// Local-এ চালানোর জন্য listen দরকার, Vercel-এ দরকার নেই
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 MediStore server running on port ${PORT}`);
    });
}

// Vercel-এর জন্য এটি অবশ্যই দিতে হবে
module.exports = app;