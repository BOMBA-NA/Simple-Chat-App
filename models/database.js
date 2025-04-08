// In-memory database
const users = [];
const posts = [];
const chats = {};
const messages = [];
const notifications = [];
const reactions = [];
const comments = [];

// Generate unique ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// User methods
const userMethods = {
  create: (userData) => {
    const newUser = {
      id: generateId(),
      username: userData.username,
      email: userData.email,
      password: userData.password, // Should be hashed before storing
      role: userData.role || 'user',
      balance: 100, // Initial balance for new users
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random`,
      createdAt: new Date(),
      isActive: true
    };
    users.push(newUser);
    return { ...newUser, password: undefined }; // Return user without password
  },
  
  findByEmail: (email) => {
    return users.find(user => user.email === email);
  },
  
  findById: (id) => {
    const user = users.find(user => user.id === id);
    if (user) {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  },
  
  update: (id, updates) => {
    const index = users.findIndex(user => user.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      const { password, ...userWithoutPassword } = users[index];
      return userWithoutPassword;
    }
    return null;
  },
  
  getAll: () => {
    return users.map(({ password, ...user }) => user);
  },
  
  transferFunds: (fromId, toId, amount) => {
    const fromIndex = users.findIndex(user => user.id === fromId);
    const toIndex = users.findIndex(user => user.id === toId);
    
    if (fromIndex === -1 || toIndex === -1) {
      return { success: false, message: 'User not found' };
    }
    
    if (users[fromIndex].balance < amount) {
      return { success: false, message: 'Insufficient funds' };
    }
    
    users[fromIndex].balance -= amount;
    users[toIndex].balance += amount;
    
    return { 
      success: true, 
      fromUser: { ...users[fromIndex], password: undefined },
      toUser: { ...users[toIndex], password: undefined }
    };
  },
  
  getLeaderboard: () => {
    return [...users]
      .sort((a, b) => b.balance - a.balance)
      .map(({ id, username, balance, avatar }) => ({ id, username, balance, avatar }));
  }
};

// Post methods
const postMethods = {
  create: (postData) => {
    const newPost = {
      id: generateId(),
      userId: postData.userId,
      content: postData.content,
      createdAt: new Date(),
      updatedAt: new Date(),
      reactions: {
        like: 0,
        love: 0,
        laugh: 0,
        wow: 0,
        sad: 0,
        angry: 0
      },
      commentsCount: 0
    };
    posts.push(newPost);
    return newPost;
  },
  
  findById: (id) => {
    return posts.find(post => post.id === id);
  },
  
  update: (id, updates) => {
    const index = posts.findIndex(post => post.id === id);
    if (index !== -1) {
      posts[index] = { 
        ...posts[index], 
        ...updates,
        updatedAt: new Date()
      };
      return posts[index];
    }
    return null;
  },
  
  delete: (id) => {
    const index = posts.findIndex(post => post.id === id);
    if (index !== -1) {
      const deletedPost = posts[index];
      posts.splice(index, 1);
      return deletedPost;
    }
    return null;
  },
  
  getAll: () => {
    return [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  
  getByUser: (userId) => {
    return posts
      .filter(post => post.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  
  addReaction: (postId, userId, reactionType) => {
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex === -1) return null;
    
    // Check if user already reacted
    const existingReaction = reactions.find(r => 
      r.postId === postId && r.userId === userId
    );
    
    if (existingReaction) {
      // Update existing reaction
      if (existingReaction.type !== reactionType) {
        posts[postIndex].reactions[existingReaction.type]--;
        posts[postIndex].reactions[reactionType]++;
        existingReaction.type = reactionType;
      }
    } else {
      // Add new reaction
      posts[postIndex].reactions[reactionType]++;
      reactions.push({
        id: generateId(),
        postId,
        userId,
        type: reactionType,
        createdAt: new Date()
      });
    }
    
    return posts[postIndex];
  },
  
  removeReaction: (postId, userId) => {
    const postIndex = posts.findIndex(post => post.id === postId);
    if (postIndex === -1) return null;
    
    const reactionIndex = reactions.findIndex(r => 
      r.postId === postId && r.userId === userId
    );
    
    if (reactionIndex !== -1) {
      const reaction = reactions[reactionIndex];
      posts[postIndex].reactions[reaction.type]--;
      reactions.splice(reactionIndex, 1);
    }
    
    return posts[postIndex];
  },
  
  getUserReaction: (postId, userId) => {
    return reactions.find(r => r.postId === postId && r.userId === userId);
  }
};

// Comment methods
const commentMethods = {
  create: (commentData) => {
    const postIndex = posts.findIndex(post => post.id === commentData.postId);
    if (postIndex === -1) return null;
    
    const newComment = {
      id: generateId(),
      postId: commentData.postId,
      userId: commentData.userId,
      content: commentData.content,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    comments.push(newComment);
    posts[postIndex].commentsCount++;
    
    return newComment;
  },
  
  getByPost: (postId) => {
    return comments
      .filter(comment => comment.postId === postId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },
  
  update: (id, updates) => {
    const index = comments.findIndex(comment => comment.id === id);
    if (index !== -1) {
      comments[index] = {
        ...comments[index],
        ...updates,
        updatedAt: new Date()
      };
      return comments[index];
    }
    return null;
  },
  
  delete: (id) => {
    const index = comments.findIndex(comment => comment.id === id);
    if (index !== -1) {
      const deletedComment = comments[index];
      
      // Decrement comments count in the post
      const postIndex = posts.findIndex(post => post.id === deletedComment.postId);
      if (postIndex !== -1) {
        posts[postIndex].commentsCount--;
      }
      
      comments.splice(index, 1);
      return deletedComment;
    }
    return null;
  }
};

// Chat methods
const chatMethods = {
  createMessage: (messageData) => {
    const newMessage = {
      id: generateId(),
      senderId: messageData.senderId,
      receiverId: messageData.receiverId,
      content: messageData.content,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
      reactions: {}
    };
    
    messages.push(newMessage);
    return newMessage;
  },
  
  getMessages: (user1Id, user2Id) => {
    return messages
      .filter(msg => 
        (msg.senderId === user1Id && msg.receiverId === user2Id) ||
        (msg.senderId === user2Id && msg.receiverId === user1Id)
      )
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },
  
  deleteMessage: (id, userId) => {
    const index = messages.findIndex(msg => msg.id === id && msg.senderId === userId);
    if (index !== -1) {
      messages[index].isDeleted = true;
      messages[index].content = "This message was deleted";
      messages[index].updatedAt = new Date();
      return messages[index];
    }
    return null;
  },
  
  addReaction: (messageId, userId, emoji) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return null;
    
    // Add or update the reaction
    messages[messageIndex].reactions[userId] = emoji;
    messages[messageIndex].updatedAt = new Date();
    
    return messages[messageIndex];
  },
  
  removeReaction: (messageId, userId) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return null;
    
    // Remove the reaction
    delete messages[messageIndex].reactions[userId];
    messages[messageIndex].updatedAt = new Date();
    
    return messages[messageIndex];
  },
  
  getRecentChats: (userId) => {
    // Get unique users that the specified user has chatted with
    const chatParticipants = new Set();
    
    messages.forEach(msg => {
      if (msg.senderId === userId) {
        chatParticipants.add(msg.receiverId);
      } else if (msg.receiverId === userId) {
        chatParticipants.add(msg.senderId);
      }
    });
    
    // For each participant, get the most recent message
    const recentChats = Array.from(chatParticipants).map(participantId => {
      const recentMessage = [...messages]
        .filter(msg => 
          (msg.senderId === userId && msg.receiverId === participantId) ||
          (msg.senderId === participantId && msg.receiverId === userId)
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      
      const participant = users.find(user => user.id === participantId);
      
      return {
        userId: participantId,
        username: participant ? participant.username : 'Unknown User',
        avatar: participant ? participant.avatar : null,
        lastMessage: recentMessage,
        timestamp: recentMessage ? recentMessage.createdAt : null
      };
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return recentChats;
  }
};

// Notification methods
const notificationMethods = {
  create: (data) => {
    const newNotification = {
      id: generateId(),
      userId: data.userId,
      type: data.type, // 'message', 'reaction', 'comment', 'transfer', etc.
      content: data.content,
      relatedId: data.relatedId, // The id of the related entity (post, message, etc.)
      createdAt: new Date(),
      isRead: false
    };
    
    notifications.push(newNotification);
    return newNotification;
  },
  
  getByUser: (userId) => {
    return notifications
      .filter(notification => notification.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  
  markAsRead: (id) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
      return notification;
    }
    return null;
  },
  
  markAllAsRead: (userId) => {
    notifications
      .filter(n => n.userId === userId)
      .forEach(n => { n.isRead = true; });
    
    return { success: true };
  }
};

module.exports = {
  users: userMethods,
  posts: postMethods,
  comments: commentMethods,
  chat: chatMethods,
  notifications: notificationMethods
};
