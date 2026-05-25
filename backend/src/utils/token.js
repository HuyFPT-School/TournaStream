const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function createAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role || "user" },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpiresIn },
  );
}

function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { createAccessToken, createRefreshToken, hashToken };
