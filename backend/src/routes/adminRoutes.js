const express = require("express");
const { getAdminStats, getUserDetails, getCoupons, createCoupon, deleteCoupon } = require("../controllers/adminController");
const { requireAdmin } = require("../middlewares/auth");

const adminRoutes = express.Router();

adminRoutes.get("/stats", requireAdmin, getAdminStats);
adminRoutes.get("/users/:id/details", requireAdmin, getUserDetails);

// Coupon routes
adminRoutes.get("/coupons", requireAdmin, getCoupons);
adminRoutes.post("/coupons", requireAdmin, createCoupon);
adminRoutes.delete("/coupons/:id", requireAdmin, deleteCoupon);

module.exports = { adminRoutes };
