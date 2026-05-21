const mongoose = require("mongoose");
const { env } = require("../config/env");

const globalState = global;
if (!globalState.__mongooseCache) {
  globalState.__mongooseCache = { conn: null, promise: null };
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
  return cache.conn;
}

module.exports = { connectDatabase };
