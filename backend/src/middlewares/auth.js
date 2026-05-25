const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret);
    req.user = { id: payload.sub, email: payload.email, role: payload.role || "user" };

    // Async throttled update of lastActiveAt
    const userId = payload.sub;
    const { User } = require("../models/User");
    User.updateOne(
      { _id: userId, $or: [{ lastActiveAt: { $exists: false } }, { lastActiveAt: { $lt: new Date(Date.now() - 15 * 60 * 1000) } }] },
      { $set: { lastActiveAt: new Date() } }
    ).catch(err => console.error("Error updating lastActiveAt:", err));

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    return next();
  });
}

module.exports = { requireAuth, requireAdmin };
