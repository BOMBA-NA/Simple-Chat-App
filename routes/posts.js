const express = require('express');
const router = express.Router();
const db = require('../models/database');
const authMiddleware = require('../middleware/auth');

// Create a new post
router.post('/', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    const post = await db.posts.create({
      userId: req.user.id,
      content
    });
    
    // Add user info to the response
    const user = await db.users.findById(req.user.id);
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
  } catch (error) {
    console.error('Error creating post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get all posts for the newsfeed
router.get('/', authMiddleware.verifyToken, async (req, res) => {
  try {
    const posts = await db.posts.getAll();
    
    // Check if posts is an array
    if (!Array.isArray(posts)) {
      console.error('Posts is not an array:', posts);
      return res.json({ posts: [] });
    }
    
    // Enhance posts with user data and current user's reactions
    const enhancedPosts = await Promise.all(posts.map(async post => {
      const user = await db.users.findById(post.userId);
      const userReaction = await db.posts.getUserReaction(post.id, req.user.id);
      
      return {
        ...post,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        },
        userReaction: userReaction ? userReaction.type : null
      };
    }));
    
    return res.json({ posts: enhancedPosts });
  } catch (error) {
    console.error('Error getting posts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific post
router.get('/:id', authMiddleware.verifyToken, async (req, res) => {
  try {
    const post = await db.posts.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const user = await db.users.findById(post.userId);
    const userReaction = await db.posts.getUserReaction(post.id, req.user.id);
    
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
  } catch (error) {
    console.error('Error getting post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update a post
router.put('/:id', authMiddleware.verifyToken, async (req, res) => {
  try {
    const post = await db.posts.findById(req.params.id);
    
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
    
    const updatedPost = await db.posts.update(req.params.id, { content });
    
    return res.json({
      message: 'Post updated successfully',
      post: updatedPost
    });
  } catch (error) {
    console.error('Error updating post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete a post
router.delete('/:id', authMiddleware.verifyToken, async (req, res) => {
  try {
    const post = await db.posts.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Allow post owner or admin to delete
    if (post.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    await db.posts.delete(req.params.id);
    
    return res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Add reaction to a post
router.post('/:id/react', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { reaction } = req.body;
    const postId = req.params.id;
    
    if (!reaction || !['like', 'love', 'laugh', 'wow', 'sad', 'angry'].includes(reaction)) {
      return res.status(400).json({ message: 'Valid reaction type is required' });
    }
    
    const post = await db.posts.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const updatedPost = await db.posts.addReaction(postId, req.user.id, reaction);
    
    // Notify post owner if it's not their own post
    if (post.userId !== req.user.id) {
      await db.notifications.create({
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
  } catch (error) {
    console.error('Error adding reaction:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Remove reaction from a post
router.delete('/:id/react', authMiddleware.verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;
    
    const post = await db.posts.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const updatedPost = await db.posts.removeReaction(postId, req.user.id);
    
    return res.json({
      message: 'Reaction removed successfully',
      post: updatedPost
    });
  } catch (error) {
    console.error('Error removing reaction:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Add comment to a post
router.post('/:id/comments', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    
    const post = await db.posts.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comment = await db.comments.create({
      postId,
      userId: req.user.id,
      content
    });
    
    // Add user info to the response
    const user = await db.users.findById(req.user.id);
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
      await db.notifications.create({
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
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get comments for a post
router.get('/:id/comments', authMiddleware.verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;
    
    const post = await db.posts.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comments = await db.comments.getByPost(postId);
    
    // Check if comments is an array
    if (!Array.isArray(comments)) {
      console.error('Comments is not an array:', comments);
      return res.json({ comments: [] });
    }
    
    // Enhance comments with user data
    const enhancedComments = await Promise.all(comments.map(async comment => {
      const user = await db.users.findById(comment.userId);
      return {
        ...comment,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        }
      };
    }));
    
    return res.json({ comments: enhancedComments });
  } catch (error) {
    console.error('Error getting comments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete a comment
router.delete('/:postId/comments/:commentId', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    const post = await db.posts.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const comments = await db.comments.getByPost(postId);
    
    if (!Array.isArray(comments)) {
      console.error('Comments is not an array:', comments);
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    const comment = comments.find(c => c.id === commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Allow comment owner, post owner, or admin to delete
    if (comment.userId !== req.user.id && post.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    await db.comments.delete(commentId);
    
    return res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
