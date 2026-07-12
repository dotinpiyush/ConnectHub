import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "👏"];

const getId = (value) => (typeof value === "string" ? value : value?._id);

const formatTime = (date) =>
  new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(new Date(date));

const formatLastSeen = (date) => {
  if (!date) return "Offline";

  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;

  return `Last seen ${Math.floor(hours / 24)}d ago`;
};

export default function Chat() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [favoriteIds, setFavoriteIds] = useState(() => {
    const saved = localStorage.getItem(`connecthub:favorites:${user._id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const activeRoomRef = useRef(null);

  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${user.token}` } }),
    [user.token]
  );

  const roomByUserId = useMemo(() => {
    return rooms.reduce((acc, room) => {
      const otherMember = room.members?.find((member) => getId(member) !== user._id);
      if (otherMember) acc[getId(otherMember)] = room;
      return acc;
    }, {});
  }, [rooms, user._id]);

  const activeUser = useMemo(() => {
    if (!activeRoom) return null;
    const roomMember = activeRoom.members?.find((member) => getId(member) !== user._id);
    return users.find((chatUser) => chatUser._id === getId(roomMember)) || roomMember;
  }, [activeRoom, user._id, users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...users]
      .filter((chatUser) => {
        if (!query) return true;
        return `${chatUser.name} ${chatUser.email}`.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const favoriteSort = favoriteIds.includes(b._id) - favoriteIds.includes(a._id);
        if (favoriteSort) return favoriteSort;

        const roomA = roomByUserId[a._id];
        const roomB = roomByUserId[b._id];
        return new Date(roomB?.updatedAt || 0) - new Date(roomA?.updatedAt || 0);
      });
  }, [favoriteIds, roomByUserId, search, users]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    localStorage.setItem(`connecthub:favorites:${user._id}`, JSON.stringify(favoriteIds));
  }, [favoriteIds, user._id]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: user.token } });
    socketRef.current = socket;

    socket.on("receive_message", (msg) => {
      const roomId = getId(msg.room);
      const isActiveRoom = activeRoomRef.current?._id === roomId;

      setRooms((prev) =>
        prev.map((room) =>
          room._id === roomId ? { ...room, lastMessage: msg, updatedAt: msg.createdAt } : room
        )
      );

      if (isActiveRoom) {
        setMessages((prev) => [...prev, msg]);
        socket.emit("mark_read", { roomId });
        return;
      }

      if (getId(msg.sender) !== user._id) {
        setUnreadCounts((prev) => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
      }
    });

    socket.on("message_reacted", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((message) => (message._id === updatedMessage._id ? updatedMessage : message))
      );
    });

    socket.on("messages_read", ({ roomId, userId }) => {
      setMessages((prev) =>
        prev.map((message) => {
          const readBy = message.readBy || [];
          const alreadyRead = readBy.some((reader) => getId(reader) === userId);

          return getId(message.room) === roomId &&
            getId(message.sender) === user._id &&
            !alreadyRead
            ? { ...message, readBy: [...readBy, { _id: userId }] }
            : message;
        })
      );
    });

    socket.on("typing", ({ userName }) => setTypingUser(userName));
    socket.on("stop_typing", () => setTypingUser(""));

    socket.on("user_online", ({ userId }) => {
      setUsers((prev) =>
        prev.map((chatUser) =>
          chatUser._id === userId ? { ...chatUser, isOnline: true } : chatUser
        )
      );
    });

    socket.on("user_offline", ({ userId, lastSeen }) => {
      setUsers((prev) =>
        prev.map((chatUser) =>
          chatUser._id === userId ? { ...chatUser, isOnline: false, lastSeen } : chatUser
        )
      );
    });

    return () => socket.disconnect();
  }, [user._id, user.token]);

  useEffect(() => {
    const loadChatData = async () => {
      const [{ data: chatUsers }, { data: chatRooms }] = await Promise.all([
        axios.get(`${API_URL}/chat/users`, authHeader),
        axios.get(`${API_URL}/chat/rooms`, authHeader),
      ]);

      setUsers(chatUsers);
      setRooms(chatRooms);
      chatRooms.forEach((room) => socketRef.current?.emit("join_room", room._id));
    };

    loadChatData();
  }, [authHeader]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const markRoomRead = async (roomId) => {
    setUnreadCounts((prev) => ({ ...prev, [roomId]: 0 }));
    await axios.patch(`${API_URL}/chat/rooms/${roomId}/read`, {}, authHeader);
    socketRef.current?.emit("mark_read", { roomId });
  };

  const openChat = async (otherUser) => {
    const { data: room } = await axios.post(
      `${API_URL}/chat/rooms`,
      { userId: otherUser._id },
      authHeader
    );

    setActiveRoom(room);
    setRooms((prev) => {
      const exists = prev.some((existingRoom) => existingRoom._id === room._id);
      return exists
        ? prev.map((existingRoom) => (existingRoom._id === room._id ? room : existingRoom))
        : [room, ...prev];
    });

    socketRef.current?.emit("join_room", room._id);

    const { data: history } = await axios.get(
      `${API_URL}/chat/rooms/${room._id}/messages`,
      authHeader
    );
    setMessages(history);
    setTypingUser("");
    await markRoomRead(room._id);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !activeRoom) return;

    socketRef.current?.emit("send_message", { roomId: activeRoom._id, text });
    socketRef.current?.emit("stop_typing", { roomId: activeRoom._id });
    setText("");
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (!activeRoom) return;

    socketRef.current?.emit("typing", { roomId: activeRoom._id, userName: user.name });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit("stop_typing", { roomId: activeRoom._id });
    }, 1500);
  };

  const toggleFavorite = (userId) => {
    setFavoriteIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const reactToMessage = (messageId, emoji) => {
    if (!activeRoom) return;
    socketRef.current?.emit("react_message", { roomId: activeRoom._id, messageId, emoji });
  };

  const activeRoomId = activeRoom?._id;

  return (
    <div className="chat-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <span className="app-mark">ConnectHub</span>
            <strong>{user.name}</strong>
          </div>
          <button onClick={logout}>Logout</button>
        </div>

        <label className="chat-search">
          <span>Search chats</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or email"
          />
        </label>

        <ul className="user-list">
          {filteredUsers.map((chatUser) => {
            const room = roomByUserId[chatUser._id];
            const isActive = activeRoomId && room?._id === activeRoomId;
            const isFavorite = favoriteIds.includes(chatUser._id);
            const unread = unreadCounts[room?._id] || 0;

            return (
              <li key={chatUser._id} className={isActive ? "active" : ""}>
                <button className="user-row" onClick={() => openChat(chatUser)}>
                  <span className={`avatar ${chatUser.isOnline ? "online" : "offline"}`}>
                    {chatUser.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="user-copy">
                    <span className="user-name">{chatUser.name}</span>
                    <span className="last-message">
                      {room?.lastMessage?.text || (chatUser.isOnline ? "Online now" : formatLastSeen(chatUser.lastSeen))}
                    </span>
                  </span>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </button>
                <button
                  className={`favorite-button ${isFavorite ? "active" : ""}`}
                  onClick={() => toggleFavorite(chatUser._id)}
                  title={isFavorite ? "Remove favorite" : "Favorite chat"}
                >
                  ★
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="chat-window">
        {activeRoom ? (
          <>
            <header className="chat-topbar">
              <span className={`avatar large ${activeUser?.isOnline ? "online" : "offline"}`}>
                {activeUser?.name?.charAt(0).toUpperCase()}
              </span>
              <div>
                <h1>{activeUser?.name}</h1>
                <p>{activeUser?.isOnline ? "Online now" : formatLastSeen(activeUser?.lastSeen)}</p>
              </div>
            </header>

            <div className="messages">
              {messages.map((message) => {
                const isMine = getId(message.sender) === user._id;
                const readByOthers = (message.readBy || []).some((reader) => getId(reader) !== user._id);

                return (
                  <div
                    key={message._id}
                    className={`message-row ${isMine ? "mine" : "theirs"}`}
                  >
                    <div className="bubble">
                      <strong>{isMine ? "You" : message.sender.name}</strong>
                      <p>{message.text}</p>
                      <span className="message-meta">
                        {formatTime(message.createdAt)}
                        {isMine && <span>{readByOthers ? "Seen" : "Sent"}</span>}
                      </span>
                    </div>

                    <div className="reaction-tray">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => reactToMessage(message._id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {message.reactions?.length > 0 && (
                      <div className="reaction-stack">
                        {message.reactions.map((reaction) => (
                          <span key={`${message._id}-${getId(reaction.user)}`}>
                            {reaction.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {typingUser && <p className="typing-indicator">{typingUser} is typing...</p>}
              <div ref={bottomRef} />
            </div>

            <form className="message-input" onSubmit={sendMessage}>
              <input value={text} onChange={handleTyping} placeholder="Type a message..." />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <h1>Pick a conversation</h1>
            <p>Search people, pin favorites, and start chatting in real time.</p>
          </div>
        )}
      </main>
    </div>
  );
}
