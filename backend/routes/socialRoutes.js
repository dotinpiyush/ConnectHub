const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const populatePost = (query) =>
  query
    .populate("author", "name email avatar bio")
    .populate("comments.author", "name email avatar")
    .populate("likes", "name email avatar");

router.get("/feed", protect, async (req, res) => {
  try {
    const posts = await populatePost(Post.find().sort({ createdAt: -1 }).limit(50));
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/posts", protect, async (req, res) => {
  try {
    const { text, imageUrl } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Post text is required" });

    const post = await Post.create({
      author: req.user._id,
      text,
      imageUrl: imageUrl || "",
    });

    const populated = await populatePost(Post.findById(post._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/posts/:postId/like", protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const alreadyLiked = post.likes.some((id) => id.toString() === req.user._id.toString());
    post.likes = alreadyLiked
      ? post.likes.filter((id) => id.toString() !== req.user._id.toString())
      : [...post.likes, req.user._id];

    await post.save();
    const populated = await populatePost(Post.findById(post._id));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/posts/:postId/comments", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required" });

    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ author: req.user._id, text });
    await post.save();

    const populated = await populatePost(Post.findById(post._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/profile", protect, async (req, res) => {
  try {
    const allowedFields = ["name", "bio", "location", "avatar", "coverImage"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    });

    await req.user.save();
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch("/users/:userId/follow", protect, async (req, res) => {
  try {
    if (req.params.userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const target = await User.findById(req.params.userId).select("-password");
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyFollowing = req.user.following.some(
      (id) => id.toString() === target._id.toString()
    );

    if (alreadyFollowing) {
      req.user.following = req.user.following.filter(
        (id) => id.toString() !== target._id.toString()
      );
      target.followers = target.followers.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      req.user.following.push(target._id);
      target.followers.push(req.user._id);
    }

    await Promise.all([req.user.save(), target.save()]);
    res.json({ following: !alreadyFollowing, user: target });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
