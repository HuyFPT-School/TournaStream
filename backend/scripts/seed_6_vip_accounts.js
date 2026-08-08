const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const path = require("path");
const dns = require("dns");

// Set IPv4 first for MongoDB SRV connection stability
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config({ path: path.join(__dirname, "../.env") });

const { User } = require("../src/models/User");
const { Coupon } = require("../src/models/Coupon");

const vipUsers = [
  {
    fullName: "Tài khoản Miễn Phí 1",
    email: "freeuser1@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
  {
    fullName: "Tài khoản Miễn Phí 2",
    email: "freeuser2@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
  {
    fullName: "Tài khoản Miễn Phí 3",
    email: "freeuser3@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
  {
    fullName: "Tài khoản Miễn Phí 4",
    email: "freeuser4@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
  {
    fullName: "Tài khoản Miễn Phí 5",
    email: "freeuser5@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
  {
    fullName: "Tài khoản Miễn Phí 6",
    email: "freeuser6@tournastream.com",
    password: "password123",
    role: "user",
    isVip: true,
    bypassPayment: true,
    isVerified: true,
  },
];

const vipCoupons = [
  {
    code: "MIENPHI100",
    discountType: "percentage",
    discountValue: 100,
    maxUses: null,
    uses: 0,
    expiryDate: null,
    isActive: true,
  },
  {
    code: "VIP100",
    discountType: "percentage",
    discountValue: 100,
    maxUses: null,
    uses: 0,
    expiryDate: null,
    isActive: true,
  },
  {
    code: "FREEVIP",
    discountType: "percentage",
    discountValue: 100,
    maxUses: null,
    uses: 0,
    expiryDate: null,
    isActive: true,
  },
];

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    // 1. Create or update 6 VIP users
    for (const u of vipUsers) {
      const existing = await User.findOne({ email: u.email });
      const passwordHash = await bcrypt.hash(u.password, 10);

      if (existing) {
        existing.isVip = true;
        existing.bypassPayment = true;
        existing.isVerified = true;
        existing.passwordHash = passwordHash;
        await existing.save();
        console.log(`Updated existing user to VIP: ${u.email}`);
      } else {
        const newUser = new User({
          fullName: u.fullName,
          email: u.email,
          passwordHash,
          isVerified: true,
          role: u.role,
          isVip: true,
          bypassPayment: true,
        });
        await newUser.save();
        console.log(`Created new VIP user: ${u.email} (Password: ${u.password})`);
      }
    }

    // 2. Create or update 100% discount coupons
    for (const c of vipCoupons) {
      const existingCoupon = await Coupon.findOne({ code: c.code });
      if (existingCoupon) {
        existingCoupon.discountType = c.discountType;
        existingCoupon.discountValue = c.discountValue;
        existingCoupon.isActive = true;
        await existingCoupon.save();
        console.log(`Updated coupon: ${c.code}`);
      } else {
        await Coupon.create(c);
        console.log(`Created 100% discount coupon: ${c.code}`);
      }
    }

    await mongoose.disconnect();
    console.log("Successfully completed seeding 6 VIP accounts and 100% discount coupons!");
  } catch (error) {
    console.error("Error during seeding:", error);
    process.exit(1);
  }
}

run();
