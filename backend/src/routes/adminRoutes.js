const express = require("express");
const { getAdminStats } = require("../controllers/adminController");
const { requireAdmin } = require("../middlewares/auth");

const adminRoutes = express.Router();

adminRoutes.get("/stats", requireAdmin, getAdminStats);

module.exports = { adminRoutes };
