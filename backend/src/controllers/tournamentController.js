const { Tournament } = require("../models/Tournament");
const { triggerTournamentUpdate } = require("../services/pusherService");

async function upsertTournament(req, res) {
  try {
    const data = req.body;
    if (!data || !data.id || !data.name) {
      return res.status(400).json({ message: "Invalid tournament data" });
    }

    const { id, lastUpdatedMatchKey } = data;
    const userId = req.user ? req.user.id : null; // Safe check for auth

    // Clean up lastUpdatedMatchKey metadata before saving
    delete data.lastUpdatedMatchKey;

    const existing = await Tournament.findOne({ id });
    let finalData = { ...data };

    if (existing) {
      // 1. Merge matchStates map
      let newMatchStates = { ...(existing.matchStates || {}) };
      if (lastUpdatedMatchKey) {
        if (data.matchStates && data.matchStates[lastUpdatedMatchKey]) {
          newMatchStates[lastUpdatedMatchKey] = data.matchStates[lastUpdatedMatchKey];
        }
      } else {
        newMatchStates = {
          ...newMatchStates,
          ...(data.matchStates || {}),
        };
      }
      finalData.matchStates = newMatchStates;

      // 2. Recalculate and merge activeMatches based on merged states for current round
      const activeMatchIdxs = new Set();
      const currentRound = data.bracket?.currentRound ?? existing.bracket?.currentRound ?? 0;
      
      if (finalData.matchStates) {
        Object.keys(finalData.matchStates).forEach(key => {
          const [rStr, mStr] = key.split('-');
          const r = parseInt(rStr, 10);
          const m = parseInt(mStr, 10);
          if (r === currentRound) {
            const ms = finalData.matchStates[key];
            if (ms && !ms.isFinished) {
              activeMatchIdxs.add(m);
            }
          }
        });
      }
      
      if (finalData.bracket) {
        finalData.bracket.activeMatches = Array.from(activeMatchIdxs);
      }
      
      // Update anyMatchRunning boolean
      finalData.anyMatchRunning = Object.values(finalData.matchStates).some(
        (ms) => ms.isRunning && !ms.isFinished
      );
    }

    // Find and update, or insert if doesn't exist
    const tournament = await Tournament.findOneAndUpdate(
      { id },
      { $set: { ...finalData, ...(userId ? { userId } : {}), updatedAt: new Date() } },
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

module.exports = {
  upsertTournament,
  getTournament,
  getUserTournaments,
  getLiveTournaments,
};
