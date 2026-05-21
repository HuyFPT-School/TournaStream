const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { env } = require("./config/env");
const { authRoutes } = require("./routes/authRoutes");

if (!env.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required");
}

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

module.exports = { app };
