const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    checkoutCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    planKey: { type: String, required: true, trim: true },
    planName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "VND" },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "paid", "amount_mismatch", "expired", "cancelled"],
    },
    qrPayload: { type: String, default: "" },
    qrImageUrl: { type: String, default: "" },
    note: { type: String, default: null },
    raw: { type: Object, required: true },
  },
  { timestamps: true },
);

transactionSchema.index({ checkoutCode: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = { Transaction };
