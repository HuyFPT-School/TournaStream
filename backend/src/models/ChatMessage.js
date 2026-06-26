const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    tournamentId: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    message: { type: String, required: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

chatMessageSchema.index({ tournamentId: 1, createdAt: -1 });

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

module.exports = { ChatMessage };
