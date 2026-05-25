const Pusher = require("pusher");
const { env } = require("../config/env");

let pusherInstance = null;

function getPusher() {
  if (!pusherInstance) {
    const appId = (env.pusherAppId || "").trim();
    const key = (env.pusherKey || "").trim();
    const secret = (env.pusherSecret || "").trim();
    const cluster = (env.pusherCluster || "ap1").trim();

    if (!appId || !key || !secret) {
      console.warn("Pusher is not fully configured. Realtime features will be disabled.");
      return null;
    }

    pusherInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }
  return pusherInstance;
}

async function triggerTournamentUpdate(tournamentId, tournamentData) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(String(tournamentId), "tournament_updated", tournamentData);
    console.log(`Pusher triggered update for tournament ${tournamentId}`);
  } catch (error) {
    console.error(`Error triggering Pusher for tournament ${tournamentId}:`, error);
  }
}

module.exports = {
  triggerTournamentUpdate,
};
