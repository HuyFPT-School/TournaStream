const express = require("express");
const { handleSepayWebhook } = require("../controllers/sepayWebhookController");

const webhookRoutes = express.Router();

webhookRoutes.post("/sepay", handleSepayWebhook);

module.exports = { webhookRoutes };
