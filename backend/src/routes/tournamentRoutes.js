const express = require("express");
const { upsertTournament, getTournament, getUserTournaments } = require("../controllers/tournamentController");
const { requireAuth } = require("../middlewares/auth");

const tournamentRoutes = express.Router();

tournamentRoutes.post("/", requireAuth, upsertTournament);
tournamentRoutes.get("/", requireAuth, getUserTournaments);
tournamentRoutes.get("/:id", getTournament); // Unprotected for spectator live view

module.exports = { tournamentRoutes };
