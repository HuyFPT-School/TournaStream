const { Tournament } = require("../models/Tournament");

async function upsertTournament(req, res) {
  try {
    const data = req.body;
    if (!data || !data.id || !data.name) {
      return res.status(400).json({ message: "Invalid tournament data" });
    }

    const { id } = data;
    // Find and update, or insert if doesn't exist
    const tournament = await Tournament.findOneAndUpdate(
      { id },
      { $set: { ...data, updatedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, tournament });
  } catch (error) {
    console.error("Error upserting tournament:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getTournament(req, res) {
  try {
    const { id } = req.params;
    const tournament = await Tournament.findOne({ id });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found" });
    }
    return res.status(200).json(tournament);
  } catch (error) {
    console.error("Error fetching tournament:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  upsertTournament,
  getTournament,
};
