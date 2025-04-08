// Database - Use the same dynamic selection as in server.js
let db;
if (process.env.USE_PG === 'true') {
  db = require('../models/pgAdapter');
} else {
  db = require('../models/database');
}

module.exports = (io, socket) => {
  // Get notifications for the current user
  socket.on('get_notifications', async (data, callback) => {
    try {
      const notifications = await db.notifications.getByUser(socket.user.id);
      
      // Ensure notifications is always an array
      const notificationsArray = Array.isArray(notifications) ? notifications : [];
      
      callback({ 
        success: true, 
        notifications: notificationsArray 
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      callback({ 
        success: false, 
        message: 'Error retrieving notifications',
        notifications: [] // Return empty array on error
      });
    }
  });
  
  // Mark notification as read
  socket.on('mark_notification_read', async (data, callback) => {
    try {
      const { notificationId } = data;
      
      if (!notificationId) {
        return callback({ 
          success: false, 
          message: 'Notification ID is required' 
        });
      }
      
      const notification = await db.notifications.markAsRead(notificationId);
      
      if (!notification) {
        return callback({ 
          success: false, 
          message: 'Notification not found' 
        });
      }
      
      callback({ 
        success: true, 
        notification 
      });
    } catch (error) {
      console.error('Mark notification read error:', error);
      callback({ 
        success: false, 
        message: 'Error marking notification as read' 
      });
    }
  });
  
  // Mark all notifications as read
  socket.on('mark_all_notifications_read', async (data, callback) => {
    try {
      await db.notifications.markAllAsRead(socket.user.id);
      
      callback({ 
        success: true, 
        message: 'All notifications marked as read' 
      });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      callback({ 
        success: false, 
        message: 'Error marking all notifications as read' 
      });
    }
  });
  
  // New posts from users they follow (not implemented in this basic version)
  // In a real app, this would be used to notify users of new content
  
  // Handle real-time post creation
  socket.on('new_post_created', async (data) => {
    // Broadcast to all users about the new post
    // In a real app, this would only go to users who follow the creator
    socket.broadcast.emit('new_post', {
      postId: data.postId,
      userId: socket.user.id,
      username: socket.user.username
    });
  });
  
  // Handle real-time post reaction
  socket.on('new_post_reaction', async (data) => {
    const { postId, reaction } = data;
    
    // In a real app, you would check if the post exists
    // and then notify the post owner
    
    // For this demo, we'll just broadcast it
    socket.broadcast.emit('post_reaction_update', {
      postId,
      userId: socket.user.id,
      username: socket.user.username,
      reaction
    });
  });
  
  // Handle real-time comment creation
  socket.on('new_comment_added', async (data) => {
    const { postId, commentId } = data;
    
    // In a real app, you would check if the post exists
    // and then notify the post owner and others who commented
    
    // For this demo, we'll just broadcast it
    socket.broadcast.emit('post_comment_update', {
      postId,
      commentId,
      userId: socket.user.id,
      username: socket.user.username
    });
  });
  
  // Handle balance updates
  socket.on('balance_updated', async (data) => {
    const { receiverId } = data;
    
    if (receiverId) {
      io.to(receiverId).emit('balance_update', {
        senderId: socket.user.id,
        senderName: socket.user.username
      });
    }
  });
};
