// PostgreSQL User Methods
const { pool } = require('./pgdb');
const bcrypt = require('bcryptjs');

// User methods
const userMethods = {
  create: async (userData) => {
    try {
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random`;
      const result = await pool.query(`
        INSERT INTO users (
          username, 
          display_name, 
          email, 
          password, 
          role, 
          is_admin, 
          admin_badge, 
          avatar
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        userData.username,
        userData.username, // Use username as display_name if not provided
        userData.email,
        userData.password,
        userData.role || 'user',
        userData.role === 'admin',
        userData.role === 'admin',
        avatarUrl
      ]);
      
      if (result.rows.length > 0) {
        return convertUserData(result.rows[0]);
      }
      return null;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },
  
  findByEmail: async (email) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length > 0) {
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  },
  
  findById: async (id) => {
    try {
      // If the ID is a MongoDB ObjectId string, return null (user needs to re-login)
      if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
        console.log('Cannot use MongoDB ObjectId with PostgreSQL. User needs to re-login.');
        return null;
      }
      
      // Handle potential string numeric id from JWT token by converting to integer
      const numericId = parseInt(id, 10);
      
      // If conversion failed and resulted in NaN, return null
      if (isNaN(numericId)) {
        console.log('Invalid user ID format:', id);
        return null;
      }
      
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [numericId]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const userObj = convertUserData(user);
        delete userObj.password;
        
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.last_active && 
          (new Date() - new Date(user.last_active) < 2 * 60 * 1000) && 
          user.online_status !== 'offline';
        
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
      // Build the query dynamically based on provided updates
      const fields = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(updates)) {
        // Convert camelCase to snake_case for PostgreSQL
        const fieldName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${fieldName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
      
      if (fields.length === 0) {
        return null;
      }
      
      values.push(id);
      
      const query = `
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      
      if (result.rows.length > 0) {
        const userObj = convertUserData(result.rows[0]);
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
      const result = await pool.query('SELECT * FROM users');
      
      return result.rows.map(user => {
        const userObj = convertUserData(user);
        delete userObj.password;
        
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.last_active && 
          (new Date() - new Date(user.last_active) < 2 * 60 * 1000) && 
          user.online_status !== 'offline';
          
        return { ...userObj, isOnline: isOnlineNow };
      });
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  },
  
  updateOnlineStatus: async (userId, status) => {
    try {
      const result = await pool.query(`
        UPDATE users 
        SET online_status = $1, last_active = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING id, username, online_status, last_active, is_admin
      `, [status, userId]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        return { 
          id: user.id,
          username: user.username,
          onlineStatus: user.online_status,
          lastActive: user.last_active,
          isAdmin: user.is_admin
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
      await pool.query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
      return true;
    } catch (error) {
      console.error('Error updating last active timestamp:', error);
      return false;
    }
  },
  
  transferFunds: async (fromId, toId, amount) => {
    const client = await pool.connect();
    
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Get sender's balance
      const fromResult = await client.query('SELECT balance FROM users WHERE id = $1', [fromId]);
      if (fromResult.rows.length === 0) {
        throw new Error('Sender not found');
      }
      
      const fromBalance = fromResult.rows[0].balance;
      if (fromBalance < amount) {
        throw new Error('Insufficient funds');
      }
      
      // Get receiver
      const toResult = await client.query('SELECT id FROM users WHERE id = $1', [toId]);
      if (toResult.rows.length === 0) {
        throw new Error('Receiver not found');
      }
      
      // Update sender's balance
      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
      
      // Update receiver's balance
      await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, toId]);
      
      // Get updated user data
      const updatedFromResult = await client.query('SELECT * FROM users WHERE id = $1', [fromId]);
      const updatedToResult = await client.query('SELECT * FROM users WHERE id = $1', [toId]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      const fromUser = convertUserData(updatedFromResult.rows[0]);
      const toUser = convertUserData(updatedToResult.rows[0]);
      
      delete fromUser.password;
      delete toUser.password;
      
      return { 
        success: true, 
        fromUser,
        toUser
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error transferring funds:', error);
      return { success: false, message: error.message || 'Error processing transfer' };
    } finally {
      client.release();
    }
  },
  
  getLeaderboard: async () => {
    try {
      const result = await pool.query('SELECT * FROM users ORDER BY balance DESC');
      
      return result.rows.map(user => {
        // Calculate if user is online based on lastActive timestamp
        const isOnlineNow = user.last_active && 
          (new Date() - new Date(user.last_active) < 2 * 60 * 1000) && 
          user.online_status !== 'offline';
        
        return { 
          id: user.id, 
          username: user.username, 
          displayName: user.display_name || user.username,
          balance: user.balance, 
          avatar: user.avatar, 
          isAdmin: !!user.is_admin, 
          adminBadge: !!user.admin_badge,
          isOnline: isOnlineNow
        };
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }
};

// Helper function to convert snake_case keys to camelCase
function convertUserData(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    password: user.password,
    role: user.role,
    isAdmin: user.is_admin,
    adminBadge: user.admin_badge,
    balance: user.balance,
    avatar: user.avatar,
    createdAt: user.created_at,
    isActive: user.is_active,
    lastActive: user.last_active,
    onlineStatus: user.online_status,
    isTyping: user.is_typing
  };
}

module.exports = userMethods;