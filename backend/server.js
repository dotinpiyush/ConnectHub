require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/db");
const User = require("./models/User");
const Room = require("./models/Room");
const Message = require("./models/Message");

const authRoutes = require("./routes/authRoutes");
const chatRoutes = require("./routes/chatRoutes");

connectDB();

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

app.get("/", (req, res) => res.send("ConnectHub API is running"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*" },
});

// Socket auth middleware - verifies JWT sent from client on connection
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  console.log(`Socket connected: ${socket.userId}`);

  // Mark user online
  await User.findByIdAndUpdate(socket.userId, { isOnline: true });
  socket.broadcast.emit("user_online", { userId: socket.userId });

  // Join a chat room
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  // Handle sending a message
  socket.on("send_message", async ({ roomId, text }) => {
    try {
      const message = await Message.create({
        room: roomId,
        sender: socket.userId,
        text,
      });
      await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });

      const populated = await message.populate("sender", "name email");
      io.to(roomId).emit("receive_message", populated);
    } catch (err) {
      socket.emit("error_message", { message: err.message });
    }
  });

  // Typing indicators
  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("typing", { userName });
  });

  socket.on("stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("stop_typing");
  });

  socket.on("disconnect", async () => {
    console.log(`Socket disconnected: ${socket.userId}`);
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: false,
      lastSeen: new Date(),
    });
    socket.broadcast.emit("user_offline", { userId: socket.userId });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
