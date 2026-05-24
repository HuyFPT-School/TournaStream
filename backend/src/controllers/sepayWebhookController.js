const crypto = require("crypto");
const mongoose = require("mongoose");
const { env } = require("../config/env");
const { Payment } = require("../models/Payment");

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(req) {
  const signatureHeader = req.get("x-sepay-signature") || "";
  if (!signatureHeader) return false;

  const secret = env.sepayWebhookSecret;
  if (!secret) return null;

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const expected = `sha256=${digest.toString("hex")}`;

  return safeEqual(signatureHeader, expected);
}

function extractOrderCode(payload) {
  const direct = payload.code || "";
  if (direct) return String(direct).trim();

  const content = payload.content || payload.transferDesc || "";
  const match = String(content).toUpperCase().match(/TS\d+/);
  return match ? match[0] : null;
}

function parseTransactionDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const normalized = String(value).replace(" ", "T");
  const fallback = new Date(normalized);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

async function handleSepayWebhook(req, res) {
  const signatureValid = verifySignature(req);
  if (signatureValid === null) {
    return res
      .status(500)
      .json({ message: "SEPAY_WEBHOOK_SECRET is not configured" });
  }
  if (!signatureValid) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const payload = req.body || {};
  const orderCode = extractOrderCode(payload);
  const sepayId = Number(payload.id);
  const amount = Number(payload.amount || 0);

  if (!Number.isFinite(sepayId) || !Number.isFinite(amount)) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  const existing = await Payment.findOne({ sepayId });
  if (existing) {
    return res.status(200).json({ success: true, duplicate: true });
  }

  const payment = new Payment({
    sepayId,
    referenceCode: payload.referenceCode || null,
    gateway: payload.gateway || null,
    transactionDate: parseTransactionDate(payload.transactionDate),
    accountNumber: payload.accountNumber || null,
    subAccount: payload.subAccount || null,
    amount,
    transferType: payload.transferType || null,
    transferDesc: payload.transferDesc || null,
    content: payload.content || null,
    code: payload.code || null,
    orderCode,
    status: "received",
    raw: payload,
  });

  await payment.save();

  if (orderCode) {
    const transactions = mongoose.connection.collection("transactions");
    const txn = await transactions.findOne({ checkoutCode: orderCode });
    const txnAmountMatches = txn ? txn.amount === amount : false;

    const orders = mongoose.connection.collection("orders");
    const order = await orders.findOne({
      $or: [{ code: orderCode }, { orderCode }, { orderId: orderCode }],
    });

    const amountFields = ["amount", "totalAmount", "price", "totalPrice"];
    const orderAmountField = amountFields.find(
      (field) => order && typeof order[field] === "number",
    );
    const orderAmount = orderAmountField ? order[orderAmountField] : null;
    const amountMatches = orderAmount === null ? (txn ? txnAmountMatches : true) : (orderAmount === amount);

    if (order) {
      await orders.updateOne(
        {
          $or: [{ code: orderCode }, { orderCode }, { orderId: orderCode }],
        },
        {
          $set: {
            status: amountMatches ? "paid" : "amount_mismatch",
            paidAt: amountMatches ? new Date() : null,
            sepayReference: payload.referenceCode || String(sepayId),
          },
        },
      );
    }

    if (txn) {
      await transactions.updateOne(
        { checkoutCode: orderCode },
        {
          $set: {
            status: txnAmountMatches ? "paid" : "amount_mismatch",
            sepayReference: payload.referenceCode || String(sepayId),
            matchedOrderAmount: orderAmount,
            paidAt: txnAmountMatches ? new Date() : null,
          },
        },
      );
    }

    payment.status = (order || txn)
      ? ((order ? amountMatches : true) && (txn ? txnAmountMatches : true))
        ? "matched"
        : "amount_mismatch"
      : "unmatched";
    await payment.save();
  }

  console.log("Received SePay webhook", {
    sepayId,
    orderCode,
    amount,
  });

  return res.status(200).json({ success: true });
}

module.exports = { handleSepayWebhook };
