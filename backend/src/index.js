const { env } = require("./config/env");
const { connectDatabase } = require("./db/connect");
const { app } = require("./app");

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
