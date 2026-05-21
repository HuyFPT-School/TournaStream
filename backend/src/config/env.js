const dotenv = require("dotenv");

dotenv.config();

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

const env = {
  port: process.env.PORT || 4000,
  mongodbUri: process.env.MONGODB_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  refreshTokenExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30),
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  cookieSecure: toBool(process.env.COOKIE_SECURE, false),
  skipEmailVerification: toBool(process.env.SKIP_EMAIL_VERIFICATION, true),
  mailerUser: process.env.MAILER_USER || "",
  mailerPassword: process.env.MAILER_PASSWORD || "",
};

module.exports = { env };
