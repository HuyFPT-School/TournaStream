const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    sepayId: { type: Number, required: true, unique: true },
    referenceCode: { type: String, default: null },
    gateway: { type: String, default: null },
    transactionDate: { type: Date, default: null },
    accountNumber: { type: String, default: null },
    subAccount: { type: String, default: null },
    amount: { type: Number, required: true },
    transferType: { type: String, default: null },
    transferDesc: { type: String, default: null },
    content: { type: String, default: null },
    code: { type: String, default: null },
    orderCode: { type: String, default: null },
    status: { type: String, default: "received" },
    raw: { type: Object, required: true },
  },
  { timestamps: true },
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment };
