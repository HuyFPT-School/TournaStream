const express = require("express");
const {
  createSepayCheckout,
} = require("../controllers/sepayPaymentController");

const paymentRoutes = express.Router();

paymentRoutes.post("/sepay/checkout", createSepayCheckout);

module.exports = { paymentRoutes };
