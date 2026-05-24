const express = require("express");
const { upsertTournament, getTournament } = require("../controllers/tournamentController");

const tournamentRoutes = express.Router();

tournamentRoutes.post("/", upsertTournament);
tournamentRoutes.get("/:id", getTournament);

module.exports = { tournamentRoutes };
