const { Tournament } = require("../models/Tournament");
const { ChatMessage } = require("../models/ChatMessage");
const { Announcement } = require("../models/Announcement");
const { triggerTournamentUpdate, triggerMatchSignaling, triggerChatMessage, triggerAnnouncement } = require("../services/pusherService");

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

// ==================== CHAT ====================

async function getChatMessages(req, res) {
  try {
    const { id } = req.params;
    const messages = await ChatMessage.find({ tournamentId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function postChatMessage(req, res) {
  try {
    const { id } = req.params;
    const { userName, message } = req.body;

    if (!userName || !message) {
      return res.status(400).json({ message: "userName and message are required" });
    }
    if (message.length > 500) {
      return res.status(400).json({ message: "Message too long (max 500 chars)" });
    }

    const chatMsg = await ChatMessage.create({
      tournamentId: id,
      userName: userName.trim().substring(0, 50),
      message: message.trim(),
    });

    try {
      await triggerChatMessage(id, chatMsg);
    } catch (err) {
      console.error("Failed to trigger Pusher chat:", err);
    }

    return res.status(201).json(chatMsg);
  } catch (error) {
    console.error("Error posting chat message:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

// ==================== ANNOUNCEMENTS ====================

async function getAnnouncements(req, res) {
  try {
    const { id } = req.params;
    const announcements = await Announcement.find({ tournamentId: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.status(200).json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function postAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { title, content, type } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "title and content are required" });
    }

    const announcement = await Announcement.create({
      tournamentId: id,
      title: title.trim(),
      content: content.trim(),
      type: type || "info",
    });

    try {
      await triggerAnnouncement(id, announcement);
    } catch (err) {
      console.error("Failed to trigger Pusher announcement:", err);
    }

    return res.status(201).json(announcement);
  } catch (error) {
    console.error("Error posting announcement:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

async function registerTeam(req, res) {
  try {
    const { id } = req.params;
    const { teamName, members } = req.body;

    if (!teamName || !teamName.trim()) {
      return res.status(400).json({ message: "Tên đội không được để trống" });
    }

    const tournament = await Tournament.findOne({ id });
    if (!tournament) {
      return res.status(404).json({ message: "Không tìm thấy giải đấu" });
    }

    if (!tournament.isPublicRegistration || !tournament.registrationOpen) {
      return res.status(400).json({ message: "Giải đấu hiện tại không mở đăng ký trực tuyến" });
    }

    if (tournament.bracketSeeded) {
      return res.status(400).json({ message: "Giải đấu đã bắt đầu, không thể đăng ký thêm" });
    }

    const currentTeams = tournament.teams || [];
    const maxTeams = tournament.maxTeams || 8;

    if (currentTeams.length >= maxTeams) {
      return res.status(400).json({ message: "Giải đấu đã đủ số lượng đội tham gia" });
    }

    const exists = currentTeams.some(
      (t) => t.name.toLowerCase() === teamName.trim().toLowerCase()
    );
    if (exists) {
      return res.status(400).json({ message: "Tên đội này đã được đăng ký" });
    }

    const newTeam = {
      id: `team_${Date.now()}`,
      name: teamName.trim(),
      members: (members || []).map((m, idx) => ({
        id: `member_${Date.now()}_${idx}`,
        name: m.name ? m.name.trim() : `Thành viên ${idx + 1}`,
        position: m.position || "",
        image: m.image || "",
      })),
    };

    const updatedTeams = [...currentTeams, newTeam];
    tournament.teams = updatedTeams;
    tournament.updatedAt = new Date();
    
    // Automatically close registration if full
    if (updatedTeams.length >= maxTeams) {
      tournament.registrationOpen = false;
    }

    await tournament.save();

    try {
      await triggerTournamentUpdate(id, tournament);
    } catch (err) {
      console.error("Failed to trigger Pusher update for registration:", err);
    }

    return res.status(200).json({ success: true, team: newTeam, tournament });
  } catch (error) {
    console.error("Error registering team:", error);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
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
};
