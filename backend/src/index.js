// 1. Ép Node.js cấu hình DNS của Google ngay khi vừa khởi động
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { env } = require("./config/env");
const { connectDatabase } = require("./db/connect");
const app = require("./app");

connectDatabase()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`API listening on port ${env.port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });
