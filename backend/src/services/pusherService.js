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

async function triggerMatchSignaling(tournamentId, signalingData) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(String(tournamentId), "match_signaling", signalingData);
  } catch (error) {
    console.error(`Error triggering Pusher signaling for tournament ${tournamentId}:`, error);
  }
}

module.exports = {
  triggerTournamentUpdate,
  triggerMatchSignaling,
  triggerChatMessage,
  triggerAnnouncement,
  triggerChatModeration,
};

async function triggerChatMessage(tournamentId, messageData) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(String(tournamentId), "chat_message", messageData);
  } catch (error) {
    console.error(`Error triggering Pusher chat for tournament ${tournamentId}:`, error);
  }
}

async function triggerAnnouncement(tournamentId, announcementData) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(String(tournamentId), "new_announcement", announcementData);
  } catch (error) {
    console.error(`Error triggering Pusher announcement for tournament ${tournamentId}:`, error);
  }
}

async function triggerChatModeration(tournamentId, moderationData) {
  const pusher = getPusher();
  if (!pusher) return;

  try {
    await pusher.trigger(String(tournamentId), "chat_moderation", moderationData);
  } catch (error) {
    console.error(`Error triggering Pusher chat moderation for tournament ${tournamentId}:`, error);
  }
}
