const { User } = require("../models/User");
const { Transaction } = require("../models/Transaction");
const { Tournament } = require("../models/Tournament");

async function getAdminStats(req, res) {
  try {
    // 0. Auto-expire pending transactions older than 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await Transaction.updateMany(
      { status: "pending", createdAt: { $lt: fifteenMinsAgo } },
      { $set: { status: "expired" } }
    );

    // 1. User stats
    const totalUsers = await User.countDocuments({});
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers24h = await User.countDocuments({
      lastActiveAt: { $gte: oneDayAgo }
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers7d = await User.countDocuments({
      lastActiveAt: { $gte: sevenDaysAgo }
    });

    // 2. Transaction / Purchase stats
    const basicTxns = await Transaction.find({ planKey: "basic", status: "paid" }).select("amount");
    const basicCount = basicTxns.length;
    const basicRevenue = basicTxns.reduce((sum, tx) => sum + tx.amount, 0);

    const premiumTxns = await Transaction.find({ planKey: "premium", status: "paid" }).select("amount");
    const premiumCount = premiumTxns.length;
    const premiumRevenue = premiumTxns.reduce((sum, tx) => sum + tx.amount, 0);

    const totalRevenue = basicRevenue + premiumRevenue;
    const totalPurchases = basicCount + premiumCount;

    // 3. Recent Transactions
    const recentTransactions = await Transaction.find({})
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // 4. Recent Tournaments
    const recentTournaments = await Tournament.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 5. Full Users List
    const usersList = await User.find({})
      .sort({ createdAt: -1 })
      .select("fullName email role isVerified lastActiveAt createdAt")
      .lean();

    // 6. Full Transactions List
    const transactionsList = await Transaction.find({})
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    // 7. Full Tournaments Feedbacks List
    const feedbacksList = await Tournament.find({ feedbacks: { $exists: true, $not: { $size: 0 } } })
      .select("name sport feedbacks updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      users: {
        total: totalUsers,
        active24h: activeUsers24h,
        active7d: activeUsers7d
      },
      purchases: {
        totalCount: totalPurchases,
        totalRevenue: totalRevenue,
        basic: {
          count: basicCount,
          revenue: basicRevenue
        },
        premium: {
          count: premiumCount,
          revenue: premiumRevenue
        }
      },
      recentTransactions,
      recentTournaments,
      usersList,
      transactionsList,
      feedbacksList
    });
  } catch (error) {
    console.error("Error gathering admin stats:", error);
    return res.status(500).json({ message: "Server error gathering admin stats" });
  }
}

async function getUserDetails(req, res) {
  try {
    const userId = req.params.id;

    // 1. Fetch user info
    const user = await User.findById(userId).select("fullName email role isVerified lastActiveAt createdAt").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Fetch tournaments created by user
    const tournaments = await Tournament.find({ userId })
      .select("name sport teams matchDuration packageId packageName packagePrice createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // 3. Fetch transactions by user
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    // 4. Fetch feedbacks for user's tournaments
    const feedbacks = await Tournament.find({
      userId,
      feedbacks: { $exists: true, $not: { $size: 0 } }
    })
      .select("name sport feedbacks updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      user,
      tournaments,
      transactions,
      feedbacks
    });
  } catch (error) {
    console.error("Error fetching user details for admin:", error);
    return res.status(500).json({ message: "Server error fetching user details" });
  }
}

async function getCoupons(req, res) {
  try {
    const { Coupon } = require("../models/Coupon");
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json(coupons);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return res.status(500).json({ message: "Server error fetching coupons" });
  }
}

async function createCoupon(req, res) {
  try {
    const { Coupon } = require("../models/Coupon");
    const { code, discountType, discountValue, maxUses, expiryDate } = req.body || {};
    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const existing = await Coupon.findOne({ code: normalizedCode });
    if (existing) {
      return res.status(409).json({ message: "Mã giảm giá đã tồn tại" });
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      discountType,
      discountValue: Number(discountValue),
      maxUses: maxUses ? Number(maxUses) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      isActive: true,
    });

    return res.status(201).json(coupon);
  } catch (error) {
    console.error("Error creating coupon:", error);
    return res.status(500).json({ message: "Server error creating coupon" });
  }
}

async function deleteCoupon(req, res) {
  try {
    const { Coupon } = require("../models/Coupon");
    const { id } = req.params;
    const result = await Coupon.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    return res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.status(500).json({ message: "Server error deleting coupon" });
  }
}

module.exports = {
  getAdminStats,
  getUserDetails,
  getCoupons,
  createCoupon,
  deleteCoupon
};
