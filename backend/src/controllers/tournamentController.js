const { Tournament } = require("../models/Tournament");
const { triggerTournamentUpdate, triggerMatchSignaling } = require("../services/pusherService");

async function upsertTournament(req, res) {
  try {
    const data = req.body;
    if (!data || !data.id || !data.name) {
      return res.status(400).json({ message: "Invalid tournament data" });
    }

    const { id } = data;
    const userId = req.user ? req.user.id : null; // Safe check for auth
    
    // Find and update, or insert if doesn't exist
    const tournament = await Tournament.findOneAndUpdate(
      { id },
      { $set: { ...data, ...(userId ? { userId } : {}), updatedAt: new Date() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
      await triggerTournamentUpdate(id, tournament);
    } catch (err) {
      console.error("Failed to trigger Pusher update:", err);
    }

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

async function getUserTournaments(req, res) {
  try {
    const userId = req.user.id;
    const tournaments = await Tournament.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json(tournaments);
  } catch (error) {
    console.error("Error fetching user tournaments:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getLiveTournaments(req, res) {
  try {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 8;

    const tournaments = await Tournament.find({
      $or: [
        {
          matchState: { $ne: null },
          "matchState.isRunning": true,
          "matchState.isFinished": { $ne: true },
        },
        {
          anyMatchRunning: true,
        },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(limit);

    return res.status(200).json(tournaments);
  } catch (error) {
    console.error("Error fetching live tournaments:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function postSignaling(req, res) {
  try {
    const { id } = req.params;
    const signalingData = req.body;

    await triggerMatchSignaling(id, signalingData);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error broadcasting signaling data:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  upsertTournament,
  getTournament,
  getUserTournaments,
  getLiveTournaments,
  postSignaling,
};
