// PostgreSQL Notifications Methods
const { pool } = require('./pgdb');

// Notifications methods
const notificationMethods = {
  // Add getByUser method to match what socket file expects
  getByUser: async (userId) => {
    // This is just an alias for getByUserId
    return notificationMethods.getByUserId(userId);
  },
  
  create: async (notificationData) => {
    try {
      const result = await pool.query(
        'INSERT INTO notifications (user_id, type, content, related_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [
          notificationData.userId,
          notificationData.type,
          notificationData.content,
          notificationData.relatedId
        ]
      );
      
      if (result.rows.length > 0) {
        const notification = result.rows[0];
        
        return {
          id: notification.id,
          userId: notification.user_id,
          type: notification.type,
          content: notification.content,
          relatedId: notification.related_id,
          createdAt: notification.created_at,
          isRead: notification.is_read
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },
  
  getByUserId: async (userId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
        [userId]
      );
      
      return result.rows.map(notification => ({
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        content: notification.content,
        relatedId: notification.related_id,
        createdAt: notification.created_at,
        isRead: notification.is_read
      }));
    } catch (error) {
      console.error('Error getting notifications by user ID:', error);
      return [];
    }
  },
  
  markAsRead: async (notificationId) => {
    try {
      const result = await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
        [notificationId]
      );
      
      if (result.rows.length > 0) {
        const notification = result.rows[0];
        
        return {
          id: notification.id,
          userId: notification.user_id,
          type: notification.type,
          content: notification.content,
          relatedId: notification.related_id,
          createdAt: notification.created_at,
          isRead: notification.is_read
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return null;
    }
  },
  
  markAllAsRead: async (userId) => {
    try {
      await pool.query(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
        [userId]
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false };
    }
  },
  
  countUnread: async (userId) => {
    try {
      const result = await pool.query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
        [userId]
      );
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      return 0;
    }
  },
  
  delete: async (notificationId) => {
    try {
      const result = await pool.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [notificationId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }
};

module.exports = notificationMethods;