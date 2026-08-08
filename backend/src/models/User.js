const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    role: { type: String, default: "user", enum: ["user", "admin"] },
    isVip: { type: Boolean, default: false },
    bypassPayment: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
    verificationTokenHash: { type: String, default: null },
    verificationTokenExpiresAt: { type: Date, default: null },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null },
    refreshTokenExpiresAt: { type: Date, default: null },
    // Referral Fields
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referralCoupons: [
      {
        code: String,
        discountValue: Number,
        referredEmail: String,
        isUsed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }
    ],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

module.exports = { User };
