const express = require("express");
const {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  getMe,
} = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");

const authRoutes = express.Router();

authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", logout);
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);
authRoutes.post("/change-password", requireAuth, changePassword);
authRoutes.get("/verify-email", verifyEmail);
authRoutes.get("/me", requireAuth, getMe);

module.exports = { authRoutes };
