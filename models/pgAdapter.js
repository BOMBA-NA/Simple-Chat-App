// PostgreSQL Adapter - Maps all the database methods to a single interface
const { pool, connectToDB, initializeDatabase, createAdminUser } = require('./pgdb');
const userMethods = require('./pgUsers');
const postMethods = require('./pgPosts');
const commentMethods = require('./pgComments');
const chatMethods = require('./pgChat');
const notificationMethods = require('./pgNotifications');

// Function to directly update a user's balance
const updateUserBalance = async (userId, newBalance) => {
  try {
    // Get user to check if exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return { success: false, message: 'User not found' };
    }
    
    // Update balance
    await pool.query('UPDATE users SET balance = $1 WHERE id = $2', [newBalance, userId]);
    
    // Get updated user
    const updatedUserResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = updatedUserResult.rows[0];
    
    // Format user data
    const userObj = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      role: user.role,
      isAdmin: user.is_admin,
      adminBadge: user.admin_badge,
      balance: user.balance,
      avatar: user.avatar,
      createdAt: user.created_at,
      isActive: user.is_active,
      lastActive: user.last_active,
      onlineStatus: user.online_status
    };
    
    return { success: true, user: userObj, newBalance };
  } catch (error) {
    console.error('Error updating user balance:', error);
    return { success: false, message: 'Database error' };
  }
};

// Function to directly find a user by ID
const findUserById = async (userId) => {
  try {
    return await userMethods.findById(userId);
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
  connectToDB,
  initializeDatabase,
  createAdminUser,
  updateUserBalance,
  findUserById
};