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

  if (qrPayload.includes("BANK=")) {
    const parts = qrPayload.split("|");
    const details = {};
    parts.forEach((p) => {
      const [key, val] = p.split("=");
      if (key && val) details[key.trim().toUpperCase()] = val.trim();
    });

    if (details.BANK && details.ACCOUNT) {
      const bank = encodeURIComponent(details.BANK);
      const account = encodeURIComponent(details.ACCOUNT);
      const amount = encodeURIComponent(details.AMOUNT || "");
      const content = encodeURIComponent(details.CONTENT || "");
      const name = encodeURIComponent(details.NAME || "");

      let url = `https://img.vietqr.io/image/${bank}-${account}-compact2.png?amount=${amount}&addInfo=${content}`;
      if (name) url += `&accountName=${name}`;
      return url;
    }
  }

  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    qrPayload,
  )}`;
}

async function createSepayCheckout(req, res) {
  const { planKey, checkoutCode: requestedCode, couponCode } = req.body || {};
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

  const userId = req.user ? req.user.id : null;

  // Compute amount based on coupon
  let finalAmount = plan.amount;
  let appliedCoupon = null;

  if (couponCode) {
    const { Coupon } = require("../models/Coupon");
    const normalizedCode = String(couponCode).trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (coupon) {
      const isValid = coupon.isActive &&
        (coupon.maxUses === null || coupon.uses < coupon.maxUses) &&
        (coupon.expiryDate === null || new Date() <= new Date(coupon.expiryDate));

      if (isValid) {
        let discount = 0;
        if (coupon.discountType === "percentage") {
          discount = Math.round(plan.amount * (coupon.discountValue / 100));
        } else if (coupon.discountType === "fixed") {
          discount = coupon.discountValue;
        }
        finalAmount = Math.max(0, plan.amount - discount);
        appliedCoupon = coupon;
      }
    }
  }

  const existing = await Transaction.findOne({ checkoutCode, userId });
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

  const isFree = finalAmount === 0;

  const qrPayload = isFree ? "" : buildQrPayload({ checkoutCode, amount: finalAmount });
  const qrImageUrl = isFree ? "" : buildQrImageUrl(qrPayload);

  const transaction = await Transaction.create({
    checkoutCode,
    userId,
    planKey: normalizedPlanKey,
    planName: plan.planName + (appliedCoupon ? ` (Mã: ${appliedCoupon.code})` : ""),
    amount: finalAmount,
    currency: "VND",
    status: isFree ? "paid" : "pending",
    qrPayload,
    qrImageUrl,
    note: `Thanh toan goi ${plan.planName}`,
    paidAt: isFree ? new Date() : null,
    raw: {
      source: "pricing-page",
      planKey: normalizedPlanKey,
      planName: plan.planName,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
    },
  });

  if (appliedCoupon) {
    appliedCoupon.uses += 1;
    await appliedCoupon.save();

    const { User } = require("../models/User");
    await User.updateOne(
      { "referralCoupons.code": appliedCoupon.code },
      { $set: { "referralCoupons.$.isUsed": true } }
    );
  }

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

async function getSepayTransactionStatus(req, res) {
  try {
    const { checkoutCode } = req.params;
    if (!checkoutCode) {
      return res.status(400).json({ message: "Checkout code is required" });
    }

    const transaction = await Transaction.findOne({
      checkoutCode: String(checkoutCode).toUpperCase().trim(),
    }).lean();

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    return res.status(200).json({
      checkoutCode: transaction.checkoutCode,
      status: transaction.status,
      paidAt: transaction.paidAt || null,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function validateCouponCode(req, res) {
  try {
    const { Coupon } = require("../models/Coupon");
    const { code, planKey } = req.body || {};
    if (!code || !planKey) {
      return res.status(400).json({ message: "Vui lòng nhập mã giảm giá và gói dịch vụ" });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (!coupon) {
      return res.status(404).json({ message: "Mã giảm giá không tồn tại" });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ message: "Mã giảm giá đã bị vô hiệu hóa" });
    }

    if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) {
      return res.status(400).json({ message: "Mã giảm giá đã hết lượt sử dụng" });
    }

    if (coupon.expiryDate !== null && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ message: "Mã giảm giá đã hết hạn sử dụng" });
    }

    // Compute expected discount and final amount
    const plan = PRICING_PLANS[String(planKey).toLowerCase()];
    if (!plan) {
      return res.status(400).json({ message: "Gói dịch vụ không hợp lệ" });
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.round(plan.amount * (coupon.discountValue / 100));
    } else if (coupon.discountType === "fixed") {
      discount = coupon.discountValue;
    }
    const finalAmount = Math.max(0, plan.amount - discount);

    return res.status(200).json({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      originalAmount: plan.amount,
      discountAmount: discount,
      finalAmount: finalAmount,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return res.status(500).json({ message: "Server error validating coupon" });
  }
}

module.exports = { createSepayCheckout, getSepayTransactionStatus, validateCouponCode };
