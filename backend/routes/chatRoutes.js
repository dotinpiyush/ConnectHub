const express = require("express");
const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// @route  GET /api/chat/rooms  -> all rooms current user belongs to
router.get("/rooms", protect, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate("members", "name email isOnline")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  POST /api/chat/rooms  -> start/find a 1-to-1 room with another user
router.post("/rooms", protect, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    let room = await Room.findOne({
      isGroup: false,
      members: { $all: [req.user._id, userId], $size: 2 },
    });

    if (!room) {
      room = await Room.create({ members: [req.user._id, userId], isGroup: false });
    }

    room = await room.populate("members", "name email isOnline");
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/chat/rooms/:roomId/messages
router.get("/rooms/:roomId/messages", protect, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId })
      .populate("sender", "name email")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route  GET /api/chat/users  -> list users to start a chat with
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      "name email isOnline"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
