const express = require('express');
const router = express.Router();
const db = require('../models/database');
const authMiddleware = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authMiddleware.verifyToken, authMiddleware.isAdmin, (req, res) => {
  const users = db.users.getAll();
  return res.json({ users });
});

// Get user profile by ID
router.get('/:id', authMiddleware.verifyToken, (req, res) => {
  const user = db.users.findById(req.params.id);
  
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  return res.json({ user });
});

// Update user profile
router.put('/profile', authMiddleware.verifyToken, (req, res) => {
  const { username, avatar } = req.body;
  const updates = {};
  
  if (username) updates.username = username;
  if (avatar) updates.avatar = avatar;
  
  const updatedUser = db.users.update(req.user.id, updates);
  
  if (!updatedUser) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  return res.json({
    message: 'Profile updated successfully',
    user: updatedUser
  });
});

// Transfer funds to another user
router.post('/transfer', authMiddleware.verifyToken, (req, res) => {
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
  
  const result = db.users.transferFunds(req.user.id, receiverId, transferAmount);
  
  if (!result.success) {
    return res.status(400).json({ message: result.message });
  }
  
  // Create notification for receiver
  const receiver = db.users.findById(receiverId);
  
  db.notifications.create({
    userId: receiverId,
    type: 'transfer',
    content: `${req.user.username} sent you ${transferAmount} coins!`,
    relatedId: req.user.id
  });
  
  return res.json({
    message: `Successfully transferred ${transferAmount} coins to ${receiver.username}`,
    balance: result.fromUser.balance
  });
});

// Get user leaderboard
router.get('/leaderboard/rankings', authMiddleware.verifyToken, (req, res) => {
  const leaderboard = db.users.getLeaderboard();
  return res.json({ leaderboard });
});

// Get user posts
router.get('/:id/posts', authMiddleware.verifyToken, (req, res) => {
  const userId = req.params.id;
  const posts = db.posts.getByUser(userId);
  
  // Enhance posts with user data
  const enhancedPosts = posts.map(post => {
    const user = db.users.findById(post.userId);
    return {
      ...post,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };
  });
  
  return res.json({ posts: enhancedPosts });
});

// Get recent chats for current user
router.get('/chats/recent', authMiddleware.verifyToken, (req, res) => {
  const recentChats = db.chat.getRecentChats(req.user.id);
  return res.json({ chats: recentChats });
});

module.exports = router;
