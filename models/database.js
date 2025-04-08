// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  displayName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isAdmin: { type: Boolean, default: false },
  adminBadge: { type: Boolean, default: false },
  balance: { type: Number, default: 100 },
  avatar: { type: String },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },
  onlineStatus: { type: String, enum: ['online', 'away', 'busy', 'offline'], default: 'offline' },
  isTyping: { type: Boolean, default: false }
});

// Post Schema
const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  reactions: {
    like: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    laugh: { type: Number, default: 0 },
    wow: { type: Number, default: 0 },
    sad: { type: Number, default: 0 },
    angry: { type: Number, default: 0 }
  },
  commentsCount: { type: Number, default: 0 }
});

// Reaction Schema
const reactionSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'love', 'laugh', 'wow', 'sad', 'angry'], required: true },
  createdAt: { type: Date, default: Date.now }
});

// Comment Schema
const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Message Schema
const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  reactions: { type: Map, of: String, default: {} }
});

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  content: { type: String, required: true },
  relatedId: { type: String },
  createdAt: { type: Date, default: Date.now },
  isRead: { type: Boolean, default: false }
});

// Create models
const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Reaction = mongoose.model('Reaction', reactionSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Message = mongoose.model('Message', messageSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// Function to create admin account if it doesn't exist
const createAdminUser = async () => {
  try {
    // Check if admin account already exists
    const adminExists = await User.findOne({ username: 'Administrator' });
    
    if (!adminExists) {
      // Create admin user with hashed password
      const hashedPassword = bcrypt.hashSync('admin', 10);
      const adminEmail = 'admin@arcadetalk.com';
      
      await User.create({
        username: 'Administrator',
        displayName: 'Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isAdmin: true,
        adminBadge: true,
        balance: 1000,
        avatar: 'https://ui-avatars.com/api/?name=Administrator&background=8a2be2&color=fff',
        isActive: true,
        lastActive: new Date(),
        onlineStatus: 'online'
      });
      
      console.log(`Admin account auto-created: email: "${adminEmail}", name: "Administrator", password: "admin"`);
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// User methods
const userMethods = {
  create: async (userData) => {
    try {
      const newUser = await User.create({
        username: userData.username,
        displayName: userData.username,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'user',
        isAdmin: userData.role === 'admin',
        adminBadge: userData.role === 'admin',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random`,
      });
      
      return newUser.toObject();
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },
  
  findByEmail: async (email) => {
    try {
      return await User.findOne({ email });
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  },
  
  findById: async (id) => {
    try {
      const user = await User.findById(id);
      if (user) {
        const userObj = user.toObject();
        delete userObj.password;
        
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.lastActive && (new Date() - new Date(user.lastActive) < 2 * 60 * 1000);
        return { 
          ...userObj, 
          isOnline: isOnlineNow 
        };
      }
      return null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  },
  
  update: async (id, updates) => {
    try {
      const user = await User.findByIdAndUpdate(id, updates, { new: true });
      if (user) {
        const userObj = user.toObject();
        delete userObj.password;
        return userObj;
      }
      return null;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  },
  
  getAll: async () => {
    try {
      const users = await User.find();
      return users.map(user => {
        const userObj = user.toObject();
        delete userObj.password;
        
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.lastActive && (new Date() - new Date(user.lastActive) < 2 * 60 * 1000);
        return { ...userObj, isOnline: isOnlineNow };
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  },
  
  updateOnlineStatus: async (userId, status) => {
    try {
      const user = await User.findByIdAndUpdate(
        userId, 
        { 
          onlineStatus: status,
          lastActive: new Date()
        },
        { new: true }
      );
      
      if (user) {
        return { 
          id: user._id,
          username: user.username,
          onlineStatus: user.onlineStatus,
          lastActive: user.lastActive,
          isAdmin: user.isAdmin
        };
      }
      return null;
    } catch (error) {
      console.error('Error updating online status:', error);
      return null;
    }
  },
  
  updateLastActive: async (userId) => {
    try {
      await User.findByIdAndUpdate(userId, { lastActive: new Date() });
      return true;
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
      return false;
    }
  },
  
  transferFunds: async (fromId, toId, amount) => {
    try {
      const fromUser = await User.findById(fromId);
      const toUser = await User.findById(toId);
      
      if (!fromUser || !toUser) {
        return { success: false, message: 'User not found' };
      }
      
      if (fromUser.balance < amount) {
        return { success: false, message: 'Insufficient funds' };
      }
      
      fromUser.balance -= amount;
      toUser.balance += amount;
      
      await fromUser.save();
      await toUser.save();
      
      const fromUserObj = fromUser.toObject();
      const toUserObj = toUser.toObject();
      
      delete fromUserObj.password;
      delete toUserObj.password;
      
      return { 
        success: true, 
        fromUser: fromUserObj,
        toUser: toUserObj
      };
    } catch (error) {
      console.error('Error transferring funds:', error);
      return { success: false, message: 'Error processing transfer' };
    }
  },
  
  getLeaderboard: async () => {
    try {
      const users = await User.find().sort({ balance: -1 });
      
      return users.map(user => {
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.lastActive && (new Date() - new Date(user.lastActive) < 2 * 60 * 1000);
        
        return { 
          id: user._id, 
          username: user.username, 
          displayName: user.displayName || user.username,
          balance: user.balance, 
          avatar: user.avatar, 
          isAdmin: !!user.isAdmin, 
          adminBadge: !!user.adminBadge,
          isOnline: isOnlineNow
        };
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }
};

// Post methods
const postMethods = {
  create: async (postData) => {
    try {
      const newPost = await Post.create({
        userId: postData.userId,
        content: postData.content
      });
      
      return newPost.toObject();
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
  },
  
  findById: async (id) => {
    try {
      return await Post.findById(id);
    } catch (error) {
      console.error('Error finding post by ID:', error);
      return null;
    }
  },
  
  update: async (id, updates) => {
    try {
      return await Post.findByIdAndUpdate(
        id, 
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating post:', error);
      return null;
    }
  },
  
  delete: async (id) => {
    try {
      const deletedPost = await Post.findByIdAndDelete(id);
      
      if (deletedPost) {
        // Delete associated comments
        await Comment.deleteMany({ postId: id });
        // Delete associated reactions
        await Reaction.deleteMany({ postId: id });
      }
      
      return deletedPost;
    } catch (error) {
      console.error('Error deleting post:', error);
      return null;
    }
  },
  
  getAll: async () => {
    try {
      return await Post.find().sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting all posts:', error);
      return [];
    }
  },
  
  getByUser: async (userId) => {
    try {
      return await Post.find({ userId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting user posts:', error);
      return [];
    }
  },
  
  addReaction: async (postId, userId, reactionType) => {
    try {
      // Check if post exists
      const post = await Post.findById(postId);
      if (!post) return null;
      
      // Check if user already reacted
      const existingReaction = await Reaction.findOne({ postId, userId });
      
      if (existingReaction) {
        // If reaction type is different, update it
        if (existingReaction.type !== reactionType) {
          // Decrement previous reaction count
          post.reactions[existingReaction.type] -= 1;
          // Increment new reaction count
          post.reactions[reactionType] += 1;
          
          // Update reaction type
          existingReaction.type = reactionType;
          await existingReaction.save();
        }
      } else {
        // Create new reaction
        await Reaction.create({
          postId,
          userId,
          type: reactionType
        });
        
        // Increment reaction count
        post.reactions[reactionType] += 1;
      }
      
      // Save updated post
      await post.save();
      return post;
    } catch (error) {
      console.error('Error adding reaction:', error);
      return null;
    }
  },
  
  removeReaction: async (postId, userId) => {
    try {
      // Check if post exists
      const post = await Post.findById(postId);
      if (!post) return null;
      
      // Find user's reaction
      const reaction = await Reaction.findOne({ postId, userId });
      
      if (reaction) {
        // Decrement reaction count
        post.reactions[reaction.type] -= 1;
        
        // Delete reaction
        await Reaction.deleteOne({ _id: reaction._id });
        
        // Save updated post
        await post.save();
      }
      
      return post;
    } catch (error) {
      console.error('Error removing reaction:', error);
      return null;
    }
  },
  
  getUserReaction: async (postId, userId) => {
    try {
      return await Reaction.findOne({ postId, userId });
    } catch (error) {
      console.error('Error getting user reaction:', error);
      return null;
    }
  }
};

// Comment methods
const commentMethods = {
  create: async (commentData) => {
    try {
      // Check if post exists
      const post = await Post.findById(commentData.postId);
      if (!post) return null;
      
      // Create comment
      const newComment = await Comment.create({
        postId: commentData.postId,
        userId: commentData.userId,
        content: commentData.content
      });
      
      // Increment post comment count
      post.commentsCount += 1;
      await post.save();
      
      return newComment;
    } catch (error) {
      console.error('Error creating comment:', error);
      return null;
    }
  },
  
  getByPost: async (postId) => {
    try {
      return await Comment.find({ postId }).sort({ createdAt: 1 });
    } catch (error) {
      console.error('Error getting post comments:', error);
      return [];
    }
  },
  
  update: async (id, updates) => {
    try {
      return await Comment.findByIdAndUpdate(
        id, 
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      console.error('Error updating comment:', error);
      return null;
    }
  },
  
  delete: async (id) => {
    try {
      const comment = await Comment.findById(id);
      if (!comment) return null;
      
      // Decrement post comment count
      const post = await Post.findById(comment.postId);
      if (post) {
        post.commentsCount -= 1;
        await post.save();
      }
      
      // Delete comment
      return await Comment.findByIdAndDelete(id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      return null;
    }
  }
};

// Chat methods
const chatMethods = {
  createMessage: async (messageData) => {
    try {
      return await Message.create({
        senderId: messageData.senderId,
        receiverId: messageData.receiverId,
        content: messageData.content
      });
    } catch (error) {
      console.error('Error creating message:', error);
      return null;
    }
  },
  
  getMessages: async (user1Id, user2Id) => {
    try {
      return await Message.find({
        $or: [
          { senderId: user1Id, receiverId: user2Id },
          { senderId: user2Id, receiverId: user1Id }
        ]
      }).sort({ createdAt: 1 });
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },
  
  deleteMessage: async (id, userId) => {
    try {
      const message = await Message.findOne({ _id: id, senderId: userId });
      
      if (message) {
        message.isDeleted = true;
        message.content = "This message was deleted";
        message.updatedAt = new Date();
        await message.save();
        return message;
      }
      
      return null;
    } catch (error) {
      console.error('Error deleting message:', error);
      return null;
    }
  },
  
  addReaction: async (messageId, userId, emoji) => {
    try {
      const message = await Message.findById(messageId);
      
      if (message) {
        // Add or update the reaction
        const reactions = message.reactions || new Map();
        reactions.set(userId.toString(), emoji);
        message.reactions = reactions;
        message.updatedAt = new Date();
        
        await message.save();
        return message;
      }
      
      return null;
    } catch (error) {
      console.error('Error adding message reaction:', error);
      return null;
    }
  },
  
  removeReaction: async (messageId, userId) => {
    try {
      const message = await Message.findById(messageId);
      
      if (message && message.reactions) {
        // Remove the reaction
        message.reactions.delete(userId.toString());
        message.updatedAt = new Date();
        
        await message.save();
        return message;
      }
      
      return null;
    } catch (error) {
      console.error('Error removing message reaction:', error);
      return null;
    }
  },
  
  getRecentChats: async (userId) => {
    try {
      // Find all messages where the user is either sender or receiver
      const messages = await Message.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }).sort({ createdAt: -1 });
      
      // Get unique user IDs that the user has chatted with
      const chatParticipants = new Set();
      
      messages.forEach(msg => {
        if (msg.senderId.toString() === userId.toString()) {
          chatParticipants.add(msg.receiverId.toString());
        } else {
          chatParticipants.add(msg.senderId.toString());
        }
      });
      
      // For each participant, get the most recent message
      const recentChats = [];
      
      for (const participantId of chatParticipants) {
        // Get the most recent message between these two users
        const recentMessage = await Message.findOne({
          $or: [
            { senderId: userId, receiverId: participantId },
            { senderId: participantId, receiverId: userId }
          ]
        }).sort({ createdAt: -1 });
        
        // Get the participant's information
        const participant = await User.findById(participantId);
        
        if (participant) {
          recentChats.push({
            userId: participantId,
            username: participant.username,
            avatar: participant.avatar,
            lastMessage: recentMessage,
            timestamp: recentMessage ? recentMessage.createdAt : null,
            isAdmin: participant.isAdmin,
            adminBadge: participant.adminBadge,
            isOnline: (new Date() - new Date(participant.lastActive)) < 2 * 60 * 1000
          });
        }
      }
      
      // Sort by most recent message
      return recentChats.sort((a, b) => 
        b.timestamp && a.timestamp ? new Date(b.timestamp) - new Date(a.timestamp) : 0
      );
    } catch (error) {
      console.error('Error getting recent chats:', error);
      return [];
    }
  }
};

// Notification methods
const notificationMethods = {
  create: async (data) => {
    try {
      return await Notification.create({
        userId: data.userId,
        type: data.type,
        content: data.content,
        relatedId: data.relatedId
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },
  
  getByUser: async (userId) => {
    try {
      return await Notification.find({ userId }).sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  },
  
  markAsRead: async (id) => {
    try {
      return await Notification.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }
  },
  
  markAllAsRead: async (userId) => {
    try {
      await Notification.updateMany(
        { userId, isRead: false },
        { isRead: true }
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false };
    }
  }
};

// Function to directly update a user's balance
const updateUserBalance = async (userId, newBalance) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { balance: newBalance },
      { new: true }
    );
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    return { success: true, user: user.toObject(), newBalance };
  } catch (error) {
    console.error('Error updating user balance:', error);
    return { success: false, message: 'Database error' };
  }
};

// Function to directly find a user by ID
const findUserById = async (userId) => {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
};

module.exports = {
  users: userMethods,
  posts: postMethods,
  comments: commentMethods,
  chat: chatMethods,
  notifications: notificationMethods,
  createAdminUser: createAdminUser,
  updateUserBalance: updateUserBalance,
  findUserById: findUserById
};