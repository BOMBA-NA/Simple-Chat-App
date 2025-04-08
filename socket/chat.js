const db = require('../models/database');

module.exports = (io, socket) => {
  // Join user's own room for private messages
  socket.join(socket.user.id);
  
  // Send message
  socket.on('send_message', async (data, callback) => {
    try {
      const { receiverId, content } = data;
      
      if (!receiverId || !content) {
        return callback({ 
          success: false, 
          message: 'Receiver ID and content are required' 
        });
      }
      
      // Check if receiver exists
      const receiver = db.users.findById(receiverId);
      if (!receiver) {
        return callback({ 
          success: false, 
          message: 'Receiver not found' 
        });
      }
      
      // Create and save the message
      const message = db.chat.createMessage({
        senderId: socket.user.id,
        receiverId,
        content
      });
      
      // Create notification for receiver
      db.notifications.create({
        userId: receiverId,
        type: 'message',
        content: `New message from ${socket.user.username}`,
        relatedId: message.id
      });
      
      // Add sender info to the message
      const sender = db.users.findById(socket.user.id);
      const enhancedMessage = {
        ...message,
        sender: {
          id: sender.id,
          username: sender.username,
          avatar: sender.avatar
        }
      };
      
      // Emit to receiver and sender
      io.to(receiverId).emit('receive_message', enhancedMessage);
      socket.emit('message_sent', enhancedMessage);
      
      // Emit notification to receiver
      io.to(receiverId).emit('new_notification', {
        type: 'message',
        senderId: socket.user.id,
        senderName: socket.user.username
      });
      
      callback({ success: true, message });
    } catch (error) {
      console.error('Send message error:', error);
      callback({ 
        success: false, 
        message: 'Error sending message' 
      });
    }
  });
  
  // Get chat history with a specific user
  socket.on('get_chat_history', async (data, callback) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        return callback({ 
          success: false, 
          message: 'User ID is required' 
        });
      }
      
      // Get messages between the two users
      const messages = db.chat.getMessages(socket.user.id, userId);
      
      // Enhance messages with sender info
      const enhancedMessages = messages.map(message => {
        const sender = db.users.findById(message.senderId);
        return {
          ...message,
          sender: {
            id: sender.id,
            username: sender.username,
            avatar: sender.avatar
          }
        };
      });
      
      callback({ 
        success: true, 
        messages: enhancedMessages 
      });
    } catch (error) {
      console.error('Get chat history error:', error);
      callback({ 
        success: false, 
        message: 'Error retrieving chat history' 
      });
    }
  });
  
  // Delete/unsend a message
  socket.on('unsend_message', async (data, callback) => {
    try {
      const { messageId } = data;
      
      if (!messageId) {
        return callback({ 
          success: false, 
          message: 'Message ID is required' 
        });
      }
      
      // Delete the message
      const deletedMessage = db.chat.deleteMessage(messageId, socket.user.id);
      
      if (!deletedMessage) {
        return callback({ 
          success: false, 
          message: 'Message not found or you are not the sender' 
        });
      }
      
      // Emit to both users
      io.to(deletedMessage.receiverId).emit('message_unsent', { messageId });
      socket.emit('message_unsent', { messageId });
      
      callback({ 
        success: true, 
        message: 'Message unsent successfully' 
      });
    } catch (error) {
      console.error('Unsend message error:', error);
      callback({ 
        success: false, 
        message: 'Error unsending message' 
      });
    }
  });
  
  // React to a message
  socket.on('react_to_message', async (data, callback) => {
    try {
      const { messageId, emoji } = data;
      
      if (!messageId || !emoji) {
        return callback({ 
          success: false, 
          message: 'Message ID and emoji are required' 
        });
      }
      
      // Add reaction to the message
      const updatedMessage = db.chat.addReaction(messageId, socket.user.id, emoji);
      
      if (!updatedMessage) {
        return callback({ 
          success: false, 
          message: 'Message not found' 
        });
      }
      
      // Get the other user's ID
      const otherUserId = updatedMessage.senderId === socket.user.id 
        ? updatedMessage.receiverId 
        : updatedMessage.senderId;
      
      // Emit to both users
      io.to(otherUserId).emit('message_reaction', { 
        messageId, 
        userId: socket.user.id, 
        emoji 
      });
      socket.emit('message_reaction', { 
        messageId, 
        userId: socket.user.id, 
        emoji 
      });
      
      // Create notification if reacting to someone else's message
      if (updatedMessage.senderId !== socket.user.id) {
        db.notifications.create({
          userId: updatedMessage.senderId,
          type: 'reaction',
          content: `${socket.user.username} reacted to your message with ${emoji}`,
          relatedId: messageId
        });
        
        // Emit notification
        io.to(updatedMessage.senderId).emit('new_notification', {
          type: 'reaction',
          senderId: socket.user.id,
          senderName: socket.user.username
        });
      }
      
      callback({ 
        success: true, 
        message: 'Reaction added successfully' 
      });
    } catch (error) {
      console.error('React to message error:', error);
      callback({ 
        success: false, 
        message: 'Error adding reaction' 
      });
    }
  });
  
  // Remove reaction from a message
  socket.on('remove_message_reaction', async (data, callback) => {
    try {
      const { messageId } = data;
      
      if (!messageId) {
        return callback({ 
          success: false, 
          message: 'Message ID is required' 
        });
      }
      
      // Remove reaction from the message
      const updatedMessage = db.chat.removeReaction(messageId, socket.user.id);
      
      if (!updatedMessage) {
        return callback({ 
          success: false, 
          message: 'Message not found' 
        });
      }
      
      // Get the other user's ID
      const otherUserId = updatedMessage.senderId === socket.user.id 
        ? updatedMessage.receiverId 
        : updatedMessage.senderId;
      
      // Emit to both users
      io.to(otherUserId).emit('message_reaction_removed', { 
        messageId, 
        userId: socket.user.id 
      });
      socket.emit('message_reaction_removed', { 
        messageId, 
        userId: socket.user.id 
      });
      
      callback({ 
        success: true, 
        message: 'Reaction removed successfully' 
      });
    } catch (error) {
      console.error('Remove message reaction error:', error);
      callback({ 
        success: false, 
        message: 'Error removing reaction' 
      });
    }
  });
  
  // Get recent chats
  socket.on('get_recent_chats', async (data, callback) => {
    try {
      const recentChats = db.chat.getRecentChats(socket.user.id);
      
      // Get all available users for chat
      const allUsers = db.users.getAll().filter(user => user.id !== socket.user.id);
      
      // Enhance each chat with online status and admin badge
      const enhancedChats = recentChats.map(chat => {
        const user = allUsers.find(u => u.id === chat.userId);
        return {
          ...chat,
          isOnline: user ? user.isOnline : false,
          isAdmin: user ? user.isAdmin : false,
          adminBadge: user ? user.adminBadge : false,
          status: user ? user.onlineStatus : 'offline'
        };
      });
      
      callback({ 
        success: true, 
        chats: enhancedChats,
        availableUsers: allUsers.map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName || user.username,
          avatar: user.avatar,
          isOnline: user.isOnline,
          status: user.onlineStatus || 'offline',
          isAdmin: user.isAdmin,
          adminBadge: user.adminBadge,
          lastActive: user.lastActive
        }))
      });
    } catch (error) {
      console.error('Get recent chats error:', error);
      callback({ 
        success: false, 
        message: 'Error retrieving recent chats' 
      });
    }
  });
  
  // User typing indicator
  socket.on('typing', (data) => {
    const { receiverId } = data;
    
    if (receiverId) {
      io.to(receiverId).emit('user_typing', {
        userId: socket.user.id,
        username: socket.user.username
      });
    }
  });
  
  // User stopped typing indicator
  socket.on('stop_typing', (data) => {
    const { receiverId } = data;
    
    if (receiverId) {
      io.to(receiverId).emit('user_stopped_typing', {
        userId: socket.user.id
      });
    }
  });
};
