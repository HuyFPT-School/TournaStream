const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { env } = require("./config/env");
const { connectDatabase } = require("./db/connect");
const { authRoutes } = require("./routes/authRoutes");

const app = express();

if (!env.jwtAccessSecret) {
  throw new Error("JWT_ACCESS_SECRET is required");
}

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

connectDatabase()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`API listening on port ${env.port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
