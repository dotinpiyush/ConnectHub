const express = require("express");
const Room = require("../models/Room");
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/rooms", protect, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id })
      .populate("members", "name email isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name email" },
      })
      .sort({ updatedAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

    room = await room.populate("members", "name email isOnline lastSeen");
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/rooms/:roomId/messages", protect, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId })
      .populate("sender", "name email")
      .populate("readBy", "name email")
      .populate("reactions.user", "name email")
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } }).select(
      "name email avatar bio isOnline lastSeen followers following"
    );
    res.json(
      users.map((user) => ({
        ...user.toObject(),
        isFollowing: req.user.following.some((id) => id.toString() === user._id.toString()),
        followersCount: user.followers.length,
      }))
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/rooms/:roomId/read", protect, async (req, res) => {
  try {
    await Message.updateMany(
      { room: req.params.roomId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
