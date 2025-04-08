// PostgreSQL Chat Methods
const { pool } = require('./pgdb');

// Chat methods
const chatMethods = {
  // Add createMessage method to match what socket file expects
  createMessage: async (messageData) => {
    // This is just an alias for sendMessage
    return chatMethods.sendMessage(messageData);
  },
  
  // Add getMessages method to match what socket file expects
  getMessages: async (userId1, userId2, limit = 50) => {
    // This is just an alias for getMessagesBetweenUsers
    return chatMethods.getMessagesBetweenUsers(userId1, userId2, limit);
  },
  
  // Add deleteMessage method to match what socket file expects
  deleteMessage: async (messageId, userId) => {
    try {
      // First check if the message exists and belongs to the user
      const messageResult = await pool.query(
        'SELECT * FROM messages WHERE id = $1 AND sender_id = $2',
        [messageId, userId]
      );
      
      if (messageResult.rows.length === 0) {
        return null; // Message not found or user is not the sender
      }
      
      // Mark as unsent instead of deleting
      const message = messageResult.rows[0];
      const success = await chatMethods.markAsUnsent(messageId);
      
      if (success) {
        return {
          id: message.id,
          senderId: message.sender_id,
          receiverId: message.receiver_id
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error deleting message:', error);
      return null;
    }
  },
  
  sendMessage: async (messageData) => {
    try {
      const result = await pool.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
        [messageData.senderId, messageData.receiverId, messageData.content]
      );
      
      if (result.rows.length > 0) {
        const message = result.rows[0];
        
        // Get sender info
        const senderResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [message.sender_id]
        );
        
        // Get receiver info
        const receiverResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [message.receiver_id]
        );
        
        if (senderResult.rows.length > 0 && receiverResult.rows.length > 0) {
          const sender = senderResult.rows[0];
          const receiver = receiverResult.rows[0];
          
          return {
            id: message.id,
            senderId: message.sender_id,
            receiverId: message.receiver_id,
            content: message.content,
            createdAt: message.created_at,
            isDeleted: message.is_deleted,
            reactions: [],
            sender: {
              id: message.sender_id,
              username: sender.username,
              displayName: sender.display_name || sender.username,
              avatar: sender.avatar,
              isAdmin: !!sender.is_admin
            },
            receiver: {
              id: message.receiver_id,
              username: receiver.username,
              displayName: receiver.display_name || receiver.username,
              avatar: receiver.avatar,
              isAdmin: !!receiver.is_admin
            }
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  },
  
  getMessagesBetweenUsers: async (userId1, userId2, limit = 50) => {
    try {
      const result = await pool.query(
        `SELECT * FROM messages 
         WHERE (sender_id = $1 AND receiver_id = $2) 
         OR (sender_id = $2 AND receiver_id = $1) 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId1, userId2, limit]
      );
      
      const messages = [];
      
      for (const message of result.rows) {
        // Get sender info
        const senderResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [message.sender_id]
        );
        
        // Get receiver info
        const receiverResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [message.receiver_id]
        );
        
        // Get message reactions
        const reactionsResult = await pool.query(
          'SELECT mr.*, u.username, u.display_name, u.avatar FROM message_reactions mr JOIN users u ON mr.user_id = u.id WHERE mr.message_id = $1',
          [message.id]
        );
        
        const reactions = reactionsResult.rows.map(reaction => ({
          id: reaction.id,
          userId: reaction.user_id,
          messageId: reaction.message_id,
          reaction: reaction.reaction,
          user: {
            id: reaction.user_id,
            username: reaction.username,
            displayName: reaction.display_name || reaction.username,
            avatar: reaction.avatar
          }
        }));
        
        if (senderResult.rows.length > 0 && receiverResult.rows.length > 0) {
          const sender = senderResult.rows[0];
          const receiver = receiverResult.rows[0];
          
          messages.push({
            id: message.id,
            senderId: message.sender_id,
            receiverId: message.receiver_id,
            content: message.content,
            createdAt: message.created_at,
            isDeleted: message.is_deleted,
            reactions,
            sender: {
              id: message.sender_id,
              username: sender.username,
              displayName: sender.display_name || sender.username,
              avatar: sender.avatar,
              isAdmin: !!sender.is_admin
            },
            receiver: {
              id: message.receiver_id,
              username: receiver.username,
              displayName: receiver.display_name || receiver.username,
              avatar: receiver.avatar,
              isAdmin: !!receiver.is_admin
            }
          });
        }
      }
      
      // Return in reverse order for proper chronological display
      return messages.reverse();
    } catch (error) {
      console.error('Error getting messages between users:', error);
      return [];
    }
  },
  
  getRecentChats: async (userId) => {
    try {
      // This query gets the most recent message between the user and each of their chat partners
      const result = await pool.query(
        `SELECT DISTINCT ON (other_user_id) 
         message_id, content, created_at, is_deleted, other_user_id, sender_id
         FROM (
           SELECT 
             m.id as message_id, 
             m.content, 
             m.created_at, 
             m.is_deleted,
             CASE 
               WHEN m.sender_id = $1 THEN m.receiver_id 
               ELSE m.sender_id 
             END as other_user_id,
             m.sender_id
           FROM messages m
           WHERE m.sender_id = $1 OR m.receiver_id = $1
         ) as subquery
         ORDER BY other_user_id, created_at DESC`,
        [userId]
      );
      
      const chats = [];
      
      for (const row of result.rows) {
        // Get other user's info
        const userResult = await pool.query(
          'SELECT id, username, display_name, avatar, is_admin, online_status, last_active FROM users WHERE id = $1',
          [row.other_user_id]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          // Calculate if user is online
          const isOnlineNow = user.last_active && 
            (new Date() - new Date(user.last_active) < 2 * 60 * 1000) && 
            user.online_status !== 'offline';
          
          chats.push({
            id: row.other_user_id, // Using other user's ID as chat ID
            userId: row.other_user_id,
            lastMessage: {
              id: row.message_id,
              content: row.content,
              senderId: row.sender_id,
              isOwnMessage: row.sender_id === parseInt(userId),
              createdAt: row.created_at,
              isDeleted: row.is_deleted
            },
            user: {
              id: user.id,
              username: user.username,
              displayName: user.display_name || user.username,
              avatar: user.avatar,
              isAdmin: !!user.is_admin,
              isOnline: isOnlineNow,
              onlineStatus: user.online_status
            }
          });
        }
      }
      
      // Sort by most recent message
      return chats.sort((a, b) => 
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
      );
    } catch (error) {
      console.error('Error getting recent chats:', error);
      return [];
    }
  },
  
  markAsUnsent: async (messageId) => {
    try {
      const result = await pool.query(
        'UPDATE messages SET is_deleted = TRUE, content = \'[Message unsent]\' WHERE id = $1 RETURNING *',
        [messageId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error marking message as unsent:', error);
      return false;
    }
  },
  
  addReaction: async (messageId, userId, reaction) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if message exists
      const messageCheck = await client.query('SELECT id FROM messages WHERE id = $1', [messageId]);
      if (messageCheck.rows.length === 0) {
        throw new Error('Message not found');
      }
      
      // Delete any existing reaction by this user on this message
      await client.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2',
        [messageId, userId]
      );
      
      // Add the new reaction
      const reactionResult = await client.query(
        'INSERT INTO message_reactions (message_id, user_id, reaction) VALUES ($1, $2, $3) RETURNING id',
        [messageId, userId, reaction]
      );
      
      // Get user information
      const userResult = await client.query(
        'SELECT id, username, display_name, avatar FROM users WHERE id = $1',
        [userId]
      );
      
      await client.query('COMMIT');
      
      if (reactionResult.rows.length > 0 && userResult.rows.length > 0) {
        const user = userResult.rows[0];
        
        return {
          id: reactionResult.rows[0].id,
          userId,
          messageId,
          reaction,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name || user.username,
            avatar: user.avatar
          }
        };
      }
      
      return null;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding message reaction:', error);
      return null;
    } finally {
      client.release();
    }
  },
  
  removeReaction: async (messageId, userId) => {
    try {
      const result = await pool.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 RETURNING id',
        [messageId, userId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error removing message reaction:', error);
      return false;
    }
  },
  
  updateTypingStatus: async (userId, isTyping) => {
    try {
      await pool.query('UPDATE users SET is_typing = $1 WHERE id = $2', [isTyping, userId]);
      return true;
    } catch (error) {
      console.error('Error updating typing status:', error);
      return false;
    }
  }
};

module.exports = chatMethods;