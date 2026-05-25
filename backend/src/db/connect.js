const mongoose = require("mongoose");
const { env } = require("../config/env");

const globalState = global;
if (!globalState.__mongooseCache) {
  globalState.__mongooseCache = { conn: null, promise: null };
}

async function seedAdminUser() {
  try {
    const { User } = require("../models/User");
    const bcrypt = require("bcryptjs");

    const email = "admin@tournastream.com";
    const existing = await User.findOne({ email });
    if (!existing) {
      const passwordHash = await bcrypt.hash("Admin@123", 10);
      const admin = new User({
        fullName: "System Admin",
        email,
        passwordHash,
        isVerified: true,
        role: "admin",
        lastActiveAt: new Date()
      });
      await admin.save();
      console.log("Seeded default admin user: admin@tournastream.com / Admin@123");
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }

  const cache = globalState.__mongooseCache;
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env.mongodbUri, { autoIndex: true })
      .then((conn) => conn);
  }

  cache.conn = await cache.promise;
  console.log("MongoDB connected");
  
  // Seed default admin user
  seedAdminUser();

  return cache.conn;
}

module.exports = { connectDatabase };
