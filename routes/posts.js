const express = require('express');
const router = express.Router();
const db = require('../models/database');
const authMiddleware = require('../middleware/auth');

// Create a new post
router.post('/', authMiddleware.verifyToken, (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ message: 'Content is required' });
  }
  
  const post = db.posts.create({
    userId: req.user.id,
    content
  });
  
  // Add user info to the response
  const user = db.users.findById(req.user.id);
  const postWithUser = {
    ...post,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar
    }
  };
  
  return res.status(201).json({
    message: 'Post created successfully',
    post: postWithUser
  });
});

// Get all posts for the newsfeed
router.get('/', authMiddleware.verifyToken, (req, res) => {
  const posts = db.posts.getAll();
  
  // Enhance posts with user data and current user's reactions
  const enhancedPosts = posts.map(post => {
    const user = db.users.findById(post.userId);
    const userReaction = db.posts.getUserReaction(post.id, req.user.id);
    
    return {
      ...post,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      userReaction: userReaction ? userReaction.type : null
    };
  });
  
  return res.json({ posts: enhancedPosts });
});

// Get a specific post
router.get('/:id', authMiddleware.verifyToken, (req, res) => {
  const post = db.posts.findById(req.params.id);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const user = db.users.findById(post.userId);
  const userReaction = db.posts.getUserReaction(post.id, req.user.id);
  
  const postWithUser = {
    ...post,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar
    },
    userReaction: userReaction ? userReaction.type : null
  };
  
  return res.json({ post: postWithUser });
});

// Update a post
router.put('/:id', authMiddleware.verifyToken, (req, res) => {
  const post = db.posts.findById(req.params.id);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  if (post.userId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to update this post' });
  }
  
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ message: 'Content is required' });
  }
  
  const updatedPost = db.posts.update(req.params.id, { content });
  
  return res.json({
    message: 'Post updated successfully',
    post: updatedPost
  });
});

// Delete a post
router.delete('/:id', authMiddleware.verifyToken, (req, res) => {
  const post = db.posts.findById(req.params.id);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  // Allow post owner or admin to delete
  if (post.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to delete this post' });
  }
  
  db.posts.delete(req.params.id);
  
  return res.json({ message: 'Post deleted successfully' });
});

// Add reaction to a post
router.post('/:id/react', authMiddleware.verifyToken, (req, res) => {
  const { reaction } = req.body;
  const postId = req.params.id;
  
  if (!reaction || !['like', 'love', 'laugh', 'wow', 'sad', 'angry'].includes(reaction)) {
    return res.status(400).json({ message: 'Valid reaction type is required' });
  }
  
  const post = db.posts.findById(postId);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const updatedPost = db.posts.addReaction(postId, req.user.id, reaction);
  
  // Notify post owner if it's not their own post
  if (post.userId !== req.user.id) {
    db.notifications.create({
      userId: post.userId,
      type: 'reaction',
      content: `${req.user.username} reacted to your post with ${reaction}`,
      relatedId: postId
    });
  }
  
  return res.json({
    message: 'Reaction added successfully',
    post: updatedPost
  });
});

// Remove reaction from a post
router.delete('/:id/react', authMiddleware.verifyToken, (req, res) => {
  const postId = req.params.id;
  
  const post = db.posts.findById(postId);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const updatedPost = db.posts.removeReaction(postId, req.user.id);
  
  return res.json({
    message: 'Reaction removed successfully',
    post: updatedPost
  });
});

// Add comment to a post
router.post('/:id/comments', authMiddleware.verifyToken, (req, res) => {
  const { content } = req.body;
  const postId = req.params.id;
  
  if (!content) {
    return res.status(400).json({ message: 'Comment content is required' });
  }
  
  const post = db.posts.findById(postId);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const comment = db.comments.create({
    postId,
    userId: req.user.id,
    content
  });
  
  // Add user info to the response
  const user = db.users.findById(req.user.id);
  const commentWithUser = {
    ...comment,
    user: {
      id: user.id,
      username: user.username,
      avatar: user.avatar
    }
  };
  
  // Notify post owner if it's not their own comment
  if (post.userId !== req.user.id) {
    db.notifications.create({
      userId: post.userId,
      type: 'comment',
      content: `${req.user.username} commented on your post`,
      relatedId: postId
    });
  }
  
  return res.status(201).json({
    message: 'Comment added successfully',
    comment: commentWithUser
  });
});

// Get comments for a post
router.get('/:id/comments', authMiddleware.verifyToken, (req, res) => {
  const postId = req.params.id;
  
  const post = db.posts.findById(postId);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const comments = db.comments.getByPost(postId);
  
  // Enhance comments with user data
  const enhancedComments = comments.map(comment => {
    const user = db.users.findById(comment.userId);
    return {
      ...comment,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };
  });
  
  return res.json({ comments: enhancedComments });
});

// Delete a comment
router.delete('/:postId/comments/:commentId', authMiddleware.verifyToken, (req, res) => {
  const { postId, commentId } = req.params;
  
  const post = db.posts.findById(postId);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  const comment = db.comments.getByPost(postId).find(c => c.id === commentId);
  
  if (!comment) {
    return res.status(404).json({ message: 'Comment not found' });
  }
  
  // Allow comment owner, post owner, or admin to delete
  if (comment.userId !== req.user.id && post.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to delete this comment' });
  }
  
  db.comments.delete(commentId);
  
  return res.json({ message: 'Comment deleted successfully' });
});

module.exports = router;
