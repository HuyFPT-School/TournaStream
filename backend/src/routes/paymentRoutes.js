const express = require("express");
const {
  createSepayCheckout,
  getSepayTransactionStatus,
} = require("../controllers/sepayPaymentController");

const paymentRoutes = express.Router();

paymentRoutes.post("/sepay/checkout", createSepayCheckout);
paymentRoutes.get("/sepay/status/:checkoutCode", getSepayTransactionStatus);

module.exports = { paymentRoutes };
