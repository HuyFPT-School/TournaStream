const mongoose = require("mongoose");
const { env } = require("../config/env");

async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(env.mongodbUri, {
    autoIndex: true,
  });
  console.log("MongoDB connected");
}

module.exports = { connectDatabase };
