const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    tournamentId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ["info", "warning", "update"],
      default: "info",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

announcementSchema.index({ tournamentId: 1, createdAt: -1 });

const Announcement = mongoose.model("Announcement", announcementSchema);

module.exports = { Announcement };
