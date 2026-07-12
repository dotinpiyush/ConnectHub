import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const initials = (name = "U") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const timeAgo = (date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export default function Social() {
  const { user, logout, updateUser } = useAuth();
  const [posts, setPosts] = useState([]);
  const [people, setPeople] = useState([]);
  const [postText, setPostText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [commentText, setCommentText] = useState({});
  const [profileDraft, setProfileDraft] = useState({
    name: user.name,
    bio: user.bio || "",
    location: user.location || "",
    avatar: user.avatar || "",
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [error, setError] = useState("");

  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${user.token}` } }),
    [user.token]
  );

  const myPosts = posts.filter((post) => post.author._id === user._id).length;

  useEffect(() => {
    const loadSocial = async () => {
      const [{ data: feed }, { data: users }] = await Promise.all([
        axios.get(`${API_URL}/social/feed`, authHeader),
        axios.get(`${API_URL}/chat/users`, authHeader),
      ]);
      setPosts(feed);
      setPeople(users);
    };

    loadSocial();
  }, [authHeader]);

  const upsertPost = (updatedPost) => {
    setPosts((prev) =>
      prev.some((post) => post._id === updatedPost._id)
        ? prev.map((post) => (post._id === updatedPost._id ? updatedPost : post))
        : [updatedPost, ...prev]
    );
  };

  const createPost = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await axios.post(
        `${API_URL}/social/posts`,
        { text: postText, imageUrl },
        authHeader
      );
      upsertPost(data);
      setPostText("");
      setImageUrl("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not publish post");
    }
  };

  const toggleLike = async (postId) => {
    const { data } = await axios.patch(`${API_URL}/social/posts/${postId}/like`, {}, authHeader);
    upsertPost(data);
  };

  const addComment = async (e, postId) => {
    e.preventDefault();
    const text = commentText[postId];
    if (!text?.trim()) return;

    const { data } = await axios.post(
      `${API_URL}/social/posts/${postId}/comments`,
      { text },
      authHeader
    );
    upsertPost(data);
    setCommentText((prev) => ({ ...prev, [postId]: "" }));
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const { data } = await axios.patch(`${API_URL}/social/profile`, profileDraft, authHeader);
    updateUser({
      name: data.name,
      bio: data.bio,
      location: data.location,
      avatar: data.avatar,
    });
    setIsEditingProfile(false);
  };

  const toggleFollow = async (personId) => {
    const { data } = await axios.patch(`${API_URL}/social/users/${personId}/follow`, {}, authHeader);
    setPeople((prev) =>
      prev.map((person) =>
        person._id === personId
          ? { ...person, isFollowing: data.following, followersCount: data.user.followers?.length }
          : person
      )
    );
  };

  return (
    <div className="social-shell">
      <nav className="social-nav">
        <Link className="brand-link" to="/social">ConnectHub</Link>
        <div>
          <Link to="/chat">Messages</Link>
          <button onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="social-grid">
        <aside className="profile-panel">
          <div className="profile-cover" />
          <div className="profile-card-body">
            {user.avatar ? (
              <img className="profile-photo" src={user.avatar} alt="" />
            ) : (
              <span className="profile-photo fallback">{initials(user.name)}</span>
            )}
            <h1>{user.name}</h1>
            <p>{user.bio || "Building connections on ConnectHub."}</p>
            <span>{user.location || "Add your location"}</span>
            <div className="profile-stats">
              <strong>{myPosts}<span>Posts</span></strong>
              <strong>{people.filter((person) => person.isFollowing).length}<span>Following</span></strong>
            </div>
            <button onClick={() => setIsEditingProfile((value) => !value)}>Edit profile</button>
          </div>

          {isEditingProfile && (
            <form className="profile-editor" onSubmit={saveProfile}>
              <input
                value={profileDraft.name}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Name"
              />
              <input
                value={profileDraft.bio}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="Bio"
              />
              <input
                value={profileDraft.location}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Location"
              />
              <input
                value={profileDraft.avatar}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, avatar: e.target.value }))}
                placeholder="Avatar image URL"
              />
              <button type="submit">Save</button>
            </form>
          )}
        </aside>

        <main className="feed-column">
          <form className="composer" onSubmit={createPost}>
            <div className="composer-head">
              <span className="mini-avatar">{initials(user.name)}</span>
              <textarea
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                placeholder="Share an update with your network..."
                rows={3}
                maxLength={1000}
                required
              />
            </div>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Optional image URL"
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">Post</button>
          </form>

          <section className="post-list">
            {posts.map((post) => {
              const liked = post.likes.some((likeUser) => likeUser._id === user._id);

              return (
                <article className="post-card" key={post._id}>
                  <header>
                    {post.author.avatar ? (
                      <img className="mini-avatar" src={post.author.avatar} alt="" />
                    ) : (
                      <span className="mini-avatar">{initials(post.author.name)}</span>
                    )}
                    <div>
                      <strong>{post.author.name}</strong>
                      <span>{post.author.bio || "ConnectHub member"} · {timeAgo(post.createdAt)}</span>
                    </div>
                  </header>
                  <p>{post.text}</p>
                  {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
                  <div className="post-actions">
                    <button className={liked ? "active" : ""} onClick={() => toggleLike(post._id)}>
                      {liked ? "Liked" : "Like"} · {post.likes.length}
                    </button>
                    <span>{post.comments.length} comments</span>
                  </div>

                  <div className="comments">
                    {post.comments.slice(-3).map((comment) => (
                      <p key={comment._id}>
                        <strong>{comment.author.name}</strong> {comment.text}
                      </p>
                    ))}
                  </div>

                  <form className="comment-form" onSubmit={(e) => addComment(e, post._id)}>
                    <input
                      value={commentText[post._id] || ""}
                      onChange={(e) =>
                        setCommentText((prev) => ({ ...prev, [post._id]: e.target.value }))
                      }
                      placeholder="Write a comment..."
                    />
                    <button type="submit">Reply</button>
                  </form>
                </article>
              );
            })}
          </section>
        </main>

        <aside className="people-panel">
          <h2>People</h2>
          {people.slice(0, 8).map((person) => (
            <div className="person-row" key={person._id}>
              <span className={`mini-avatar ${person.isOnline ? "online" : ""}`}>
                {initials(person.name)}
              </span>
              <div>
                <strong>{person.name}</strong>
                <span>{person.isOnline ? "Online now" : "Available to connect"}</span>
              </div>
              <button onClick={() => toggleFollow(person._id)}>
                {person.isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
