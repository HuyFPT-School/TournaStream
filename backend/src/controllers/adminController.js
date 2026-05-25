const { User } = require("../models/User");
const { Transaction } = require("../models/Transaction");
const { Tournament } = require("../models/Tournament");

async function getAdminStats(req, res) {
  try {
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
      transactionsList
    });
  } catch (error) {
    console.error("Error gathering admin stats:", error);
    return res.status(500).json({ message: "Server error gathering admin stats" });
  }
}

module.exports = {
  getAdminStats
};
