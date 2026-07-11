import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";

export default function Chat() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);

  const authHeader = { headers: { Authorization: `Bearer ${user.token}` } };

  // Set up socket connection once
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: user.token } });
    socketRef.current = socket;

    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("typing", ({ userName }) => setTypingUser(userName));
    socket.on("stop_typing", () => setTypingUser(""));

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load other users to start chats with
  useEffect(() => {
    axios.get(`${API_URL}/chat/users`, authHeader).then((res) => setUsers(res.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openChat = async (otherUser) => {
    const { data: room } = await axios.post(
      `${API_URL}/chat/rooms`,
      { userId: otherUser._id },
      authHeader
    );
    setActiveRoom(room);
    socketRef.current.emit("join_room", room._id);

    const { data: history } = await axios.get(
      `${API_URL}/chat/rooms/${room._id}/messages`,
      authHeader
    );
    setMessages(history);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !activeRoom) return;
    socketRef.current.emit("send_message", { roomId: activeRoom._id, text });
    socketRef.current.emit("stop_typing", { roomId: activeRoom._id });
    setText("");
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeRoom) return;
    socketRef.current.emit("typing", { roomId: activeRoom._id, userName: user.name });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current.emit("stop_typing", { roomId: activeRoom._id });
    }, 1500);
  };

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span>{user.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
        <ul className="user-list">
          {users.map((u) => (
            <li key={u._id} onClick={() => openChat(u)}
                className={activeRoom?.members?.some((m) => m._id === u._id) ? "active" : ""}>
              <span className={`dot ${u.isOnline ? "online" : "offline"}`} />
              {u.name}
            </li>
          ))}
        </ul>
      </aside>

      <main className="chat-window">
        {activeRoom ? (
          <>
            <div className="messages">
              {messages.map((m) => (
                <div key={m._id}
                     className={`bubble ${m.sender._id === user._id ? "mine" : "theirs"}`}>
                  <strong>{m.sender.name}</strong>
                  <p>{m.text}</p>
                </div>
              ))}
              {typingUser && <p className="typing-indicator">{typingUser} is typing...</p>}
              <div ref={bottomRef} />
            </div>
            <form className="message-input" onSubmit={sendMessage}>
              <input value={text} onChange={handleTyping} placeholder="Type a message..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <p className="empty-state">Select a user to start chatting</p>
        )}
      </main>
    </div>
  );
}
