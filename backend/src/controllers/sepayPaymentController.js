const { env } = require("../config/env");
const { Transaction } = require("../models/Transaction");

const PRICING_PLANS = {
  basic: {
    planName: "Cơ bản",
    amount: 49000,
  },
  premium: {
    planName: "Cao cấp",
    amount: 99000,
  },
};

function createCheckoutCode() {
  return `TS${Date.now().toString().slice(-6)}`.toUpperCase();
}

function buildQrPayload({ checkoutCode, amount }) {
  const bankName = env.sepayBankName.trim();
  const accountNumber = env.sepayAccountNumber.trim();
  const accountName = env.sepayAccountName.trim();

  if (bankName && accountNumber) {
    return [
      `BANK=${bankName}`,
      `ACCOUNT=${accountNumber}`,
      accountName ? `NAME=${accountName}` : null,
      `AMOUNT=${amount}`,
      `CONTENT=${checkoutCode}`,
    ]
      .filter(Boolean)
      .join("|");
  }

  return `SEPAY|CONTENT=${checkoutCode}|AMOUNT=${amount}`;
}

function buildQrImageUrl(qrPayload) {
  if (env.sepayQrImageUrl) {
    return env.sepayQrImageUrl;
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    qrPayload,
  )}`;
}

async function createSepayCheckout(req, res) {
  const { planKey, checkoutCode: requestedCode } = req.body || {};
  const normalizedPlanKey = String(planKey || "")
    .trim()
    .toLowerCase();
  const plan = PRICING_PLANS[normalizedPlanKey];

  if (!plan) {
    return res.status(400).json({ message: "Invalid plan" });
  }

  const checkoutCode = String(requestedCode || createCheckoutCode())
    .trim()
    .toUpperCase();

  const existing = await Transaction.findOne({ checkoutCode });
  if (existing) {
    return res.status(200).json({
      checkoutCode: existing.checkoutCode,
      planKey: existing.planKey,
      planName: existing.planName,
      amount: existing.amount,
      qrPayload: existing.qrPayload,
      qrImageUrl: existing.qrImageUrl,
      status: existing.status,
    });
  }

  const qrPayload = buildQrPayload({ checkoutCode, amount: plan.amount });
  const qrImageUrl = buildQrImageUrl(qrPayload);

  const transaction = await Transaction.create({
    checkoutCode,
    planKey: normalizedPlanKey,
    planName: plan.planName,
    amount: plan.amount,
    currency: "VND",
    status: "pending",
    qrPayload,
    qrImageUrl,
    note: `Thanh toan goi ${plan.planName}`,
    raw: {
      source: "pricing-page",
      planKey: normalizedPlanKey,
      planName: plan.planName,
    },
  });

  return res.status(201).json({
    checkoutCode: transaction.checkoutCode,
    planKey: transaction.planKey,
    planName: transaction.planName,
    amount: transaction.amount,
    qrPayload: transaction.qrPayload,
    qrImageUrl: transaction.qrImageUrl,
    status: transaction.status,
  });
}

module.exports = { createSepayCheckout };
