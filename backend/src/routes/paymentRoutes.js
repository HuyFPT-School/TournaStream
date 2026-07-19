const express = require("express");
const {
  createSepayCheckout,
  getSepayTransactionStatus,
  cancelSepayCheckout,
  validateCouponCode,
} = require("../controllers/sepayPaymentController");
const { requireAuth } = require("../middlewares/auth");

const paymentRoutes = express.Router();

paymentRoutes.post("/sepay/checkout", requireAuth, createSepayCheckout);
paymentRoutes.post("/sepay/cancel", requireAuth, cancelSepayCheckout);
paymentRoutes.get("/sepay/status/:checkoutCode", getSepayTransactionStatus);
paymentRoutes.post("/coupon/validate", requireAuth, validateCouponCode);

module.exports = { paymentRoutes };
