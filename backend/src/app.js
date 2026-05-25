const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { env } = require("./config/env");
const { authRoutes } = require("./routes/authRoutes");
const { paymentRoutes } = require("./routes/paymentRoutes");
const { webhookRoutes } = require("./routes/webhookRoutes");
const { tournamentRoutes } = require("./routes/tournamentRoutes");
const { adminRoutes } = require("./routes/adminRoutes");

if (!env.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required");
}

const app = express();

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cookieParser());
const allowedOrigins = [
  "http://localhost:3000", // Allow local dev
  "https://tourna-stream-cktn.vercel.app", // Replace with real Vercel domain
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isLocalIP =
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.startsWith("http://192.168.") ||
        origin.startsWith("http://10.") ||
        origin.startsWith("http://172.");

      if (allowedOrigins.includes(origin) || isLocalIP) {
        return callback(null, true);
      }

      return callback(new Error("Blocked by CORS: invalid origin"));
    },
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/tournaments", tournamentRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

module.exports = app;
