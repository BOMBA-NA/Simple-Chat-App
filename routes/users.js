const express = require('express');
const router = express.Router();
const db = require('../models/database');
const authMiddleware = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authMiddleware.verifyToken, authMiddleware.isAdmin, async (req, res) => {
  try {
    const users = await db.users.getAll();
    return res.json({ users });
  } catch (error) {
    console.error('Error getting all users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile by ID
router.get('/:id', authMiddleware.verifyToken, async (req, res) => {
  try {
    const user = await db.users.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json({ user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const updates = {};
    
    if (username) updates.username = username;
    if (avatar) updates.avatar = avatar;
    
    const updatedUser = await db.users.update(req.user.id, updates);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Transfer funds to another user
router.post('/transfer', authMiddleware.verifyToken, async (req, res) => {
  try {
    const { receiverId, amount } = req.body;
    
    if (!receiverId || !amount) {
      return res.status(400).json({ message: 'Receiver ID and amount are required' });
    }
    
    // Convert amount to number and validate
    const transferAmount = parseFloat(amount);
    
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be a positive number' });
    }
    
    // Prevent self-transfer
    if (req.user.id === receiverId) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }
    
    const result = await db.users.transferFunds(req.user.id, receiverId, transferAmount);
    
    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }
    
    // Create notification for receiver
    const receiver = await db.users.findById(receiverId);
    
    await db.notifications.create({
      userId: receiverId,
      type: 'transfer',
      content: `${req.user.username} sent you ${transferAmount} coins!`,
      relatedId: req.user.id
    });
    
    return res.json({
      message: `Successfully transferred ${transferAmount} coins to ${receiver.username}`,
      balance: result.fromUser.balance
    });
  } catch (error) {
    console.error('Error transferring funds:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get user leaderboard
router.get('/leaderboard/rankings', authMiddleware.verifyToken, async (req, res) => {
  try {
    const leaderboard = await db.users.getLeaderboard();
    return res.json({ leaderboard });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get user posts
router.get('/:id/posts', authMiddleware.verifyToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const posts = await db.posts.getByUser(userId);
    
    // Check if posts is an array
    if (!Array.isArray(posts)) {
      console.error('Posts is not an array:', posts);
      return res.json({ posts: [] });
    }
    
    // Enhance posts with user data
    const enhancedPosts = await Promise.all(posts.map(async post => {
      const user = await db.users.findById(post.userId);
      return {
        ...post,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        }
      };
    }));
    
    return res.json({ posts: enhancedPosts });
  } catch (error) {
    console.error('Error getting user posts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get recent chats for current user
router.get('/chats/recent', authMiddleware.verifyToken, async (req, res) => {
  try {
    const recentChats = await db.chat.getRecentChats(req.user.id);
    return res.json({ chats: recentChats });
  } catch (error) {
    console.error('Error getting recent chats:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
