const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // Client-side generated ID e.g. tourn_123
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    sport: { type: String, default: "" },
    packageId: { type: String, default: "" },
    packageName: { type: String, default: "" },
    packagePrice: { type: Number, default: 0 },
    matchDuration: { type: Number, default: 45 },
    allowExtraTime: { type: Boolean, default: false },
    teams: { type: Array, default: [] },
    isPublicRegistration: { type: Boolean, default: false },
    registrationOpen: { type: Boolean, default: false },
    maxTeams: { type: Number, default: 8 },
    bracketSeeded: { type: Boolean, default: false },
    shuffled: { type: Boolean, default: false },
    matchState: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { strict: false, timestamps: true }
);

const Tournament = mongoose.model("Tournament", tournamentSchema);

module.exports = { Tournament };
