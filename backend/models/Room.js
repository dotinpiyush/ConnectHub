const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true }, // used for group chats
    isGroup: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
