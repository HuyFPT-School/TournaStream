const express = require("express");
const {
  upsertTournament,
  getTournament,
  getUserTournaments,
  getLiveTournaments,
  postSignaling,
  getChatMessages,
  postChatMessage,
  getAnnouncements,
  postAnnouncement,
  registerTeam,
  blockChatUser,
  unblockChatUser,
} = require("../controllers/tournamentController");
const { requireAuth } = require("../middlewares/auth");

const tournamentRoutes = express.Router();

tournamentRoutes.post("/", requireAuth, upsertTournament);
tournamentRoutes.get("/", requireAuth, getUserTournaments);
tournamentRoutes.get("/live", getLiveTournaments);
tournamentRoutes.get("/:id", getTournament); // Unprotected for spectator live view
tournamentRoutes.post("/:id/signaling", postSignaling); // Unprotected for spectator-referee WebRTC signaling
tournamentRoutes.post("/:id/register-team", registerTeam); // Public registration for teams

// Chat - open to everyone
tournamentRoutes.get("/:id/chat", getChatMessages);
tournamentRoutes.post("/:id/chat", postChatMessage);
tournamentRoutes.post("/:id/chat/block", requireAuth, blockChatUser);
tournamentRoutes.post("/:id/chat/unblock", requireAuth, unblockChatUser);

// Announcements - read is open, post requires auth
tournamentRoutes.get("/:id/announcements", getAnnouncements);
tournamentRoutes.post("/:id/announcements", requireAuth, postAnnouncement);

module.exports = { tournamentRoutes };
