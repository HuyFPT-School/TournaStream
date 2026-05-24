const app = require("../src/app");
const { connectDatabase } = require("../src/db/connect");

module.exports = async (req, res) => {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
