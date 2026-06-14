const express = require("express");
const { getAdminStats, getUserDetails } = require("../controllers/adminController");
const { requireAdmin } = require("../middlewares/auth");

const adminRoutes = express.Router();

adminRoutes.get("/stats", requireAdmin, getAdminStats);
adminRoutes.get("/users/:id/details", requireAdmin, getUserDetails);

module.exports = { adminRoutes };
