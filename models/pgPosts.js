// PostgreSQL Post Methods
const { pool } = require('./pgdb');

// Post methods
const postMethods = {
  // Add getByUser method as an alias for getByUserId
  getByUser: async (userId) => {
    // Just call the existing getByUserId method
    return postMethods.getByUserId(userId);
  },
  create: async (postData) => {
    try {
      const result = await pool.query(
        'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING *',
        [postData.userId, postData.content]
      );
      
      if (result.rows.length > 0) {
        const post = result.rows[0];
        
        // Get user information
        const userResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [post.user_id]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          return {
            id: post.id,
            userId: post.user_id,
            content: post.content,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            user: {
              id: post.user_id,
              username: user.username,
              displayName: user.display_name || user.username,
              avatar: user.avatar,
              isAdmin: !!user.is_admin
            },
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
        }
      }
      return null;
    } catch (error) {
      console.error('Error creating post:', error);
      return null;
    }
  },
  
  getAll: async (page = 1, limit = 20) => {
    try {
      const offset = (page - 1) * limit;
      
      // Get posts with pagination
      const result = await pool.query(
        'SELECT * FROM posts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      
      const posts = [];
      
      for (const post of result.rows) {
        // Get user information for each post
        const userResult = await pool.query(
          'SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [post.user_id]
        );
        
        // Get reactions counts for the post
        const reactionsResult = await pool.query(
          'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = $1 GROUP BY type',
          [post.id]
        );
        
        // Format reactions
        const reactions = {
          like: 0,
          love: 0,
          laugh: 0,
          wow: 0,
          sad: 0,
          angry: 0
        };
        
        reactionsResult.rows.forEach(row => {
          if (reactions.hasOwnProperty(row.type)) {
            reactions[row.type] = parseInt(row.count);
          }
        });
        
        // Get comments count
        const commentsResult = await pool.query(
          'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
          [post.id]
        );
        
        const commentsCount = parseInt(commentsResult.rows[0].count);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          posts.push({
            id: post.id,
            userId: post.user_id,
            content: post.content,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            reactions,
            commentsCount,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.display_name || user.username,
              avatar: user.avatar,
              isAdmin: !!user.is_admin
            }
          });
        }
      }
      
      return posts;
    } catch (error) {
      console.error('Error getting all posts:', error);
      return [];
    }
  },
  
  getById: async (postId) => {
    try {
      const result = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      
      if (result.rows.length > 0) {
        const post = result.rows[0];
        
        // Get user information
        const userResult = await pool.query(
          'SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [post.user_id]
        );
        
        // Get reactions counts
        const reactionsResult = await pool.query(
          'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = $1 GROUP BY type',
          [post.id]
        );
        
        // Format reactions
        const reactions = {
          like: 0,
          love: 0,
          laugh: 0,
          wow: 0,
          sad: 0,
          angry: 0
        };
        
        reactionsResult.rows.forEach(row => {
          if (reactions.hasOwnProperty(row.type)) {
            reactions[row.type] = parseInt(row.count);
          }
        });
        
        // Get comments count
        const commentsResult = await pool.query(
          'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
          [post.id]
        );
        
        const commentsCount = parseInt(commentsResult.rows[0].count);
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          return {
            id: post.id,
            userId: post.user_id,
            content: post.content,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            reactions,
            commentsCount,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.display_name || user.username,
              avatar: user.avatar,
              isAdmin: !!user.is_admin
            }
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting post by ID:', error);
      return null;
    }
  },
  
  getByUserId: async (userId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      const posts = [];
      
      // Get user information once (same for all posts)
      const userResult = await pool.query(
        'SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        return [];
      }
      
      const user = userResult.rows[0];
      
      for (const post of result.rows) {
        // Get reactions counts for the post
        const reactionsResult = await pool.query(
          'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = $1 GROUP BY type',
          [post.id]
        );
        
        // Format reactions
        const reactions = {
          like: 0,
          love: 0,
          laugh: 0,
          wow: 0,
          sad: 0,
          angry: 0
        };
        
        reactionsResult.rows.forEach(row => {
          if (reactions.hasOwnProperty(row.type)) {
            reactions[row.type] = parseInt(row.count);
          }
        });
        
        // Get comments count
        const commentsResult = await pool.query(
          'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
          [post.id]
        );
        
        const commentsCount = parseInt(commentsResult.rows[0].count);
        
        posts.push({
          id: post.id,
          userId: post.user_id,
          content: post.content,
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          reactions,
          commentsCount,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name || user.username,
            avatar: user.avatar,
            isAdmin: !!user.is_admin
          }
        });
      }
      
      return posts;
    } catch (error) {
      console.error('Error getting posts by user ID:', error);
      return [];
    }
  },
  
  delete: async (postId) => {
    try {
      // This will cascade delete related reactions and comments due to FK constraints
      const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING id', [postId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  },
  
  addReaction: async (postId, userId, reactionType) => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if post exists
      const postCheck = await client.query('SELECT id FROM posts WHERE id = $1', [postId]);
      if (postCheck.rows.length === 0) {
        throw new Error('Post not found');
      }
      
      // Delete any existing reaction by this user on this post
      await client.query(
        'DELETE FROM reactions WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      
      // Add the new reaction
      await client.query(
        'INSERT INTO reactions (post_id, user_id, type) VALUES ($1, $2, $3)',
        [postId, userId, reactionType]
      );
      
      // Get the updated reaction counts
      const reactionsResult = await client.query(
        'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = $1 GROUP BY type',
        [postId]
      );
      
      const reactions = {
        like: 0,
        love: 0,
        laugh: 0,
        wow: 0,
        sad: 0,
        angry: 0
      };
      
      reactionsResult.rows.forEach(row => {
        if (reactions.hasOwnProperty(row.type)) {
          reactions[row.type] = parseInt(row.count);
        }
      });
      
      await client.query('COMMIT');
      
      return {
        success: true,
        postId,
        reactions
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding reaction:', error);
      return { success: false, message: error.message };
    } finally {
      client.release();
    }
  },
  
  removeReaction: async (postId, userId) => {
    try {
      // Delete the reaction
      await pool.query(
        'DELETE FROM reactions WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      
      // Get the updated reaction counts
      const reactionsResult = await pool.query(
        'SELECT type, COUNT(*) as count FROM reactions WHERE post_id = $1 GROUP BY type',
        [postId]
      );
      
      const reactions = {
        like: 0,
        love: 0,
        laugh: 0,
        wow: 0,
        sad: 0,
        angry: 0
      };
      
      reactionsResult.rows.forEach(row => {
        if (reactions.hasOwnProperty(row.type)) {
          reactions[row.type] = parseInt(row.count);
        }
      });
      
      return {
        success: true,
        postId,
        reactions
      };
    } catch (error) {
      console.error('Error removing reaction:', error);
      return { success: false, message: error.message };
    }
  },
  
  getUserReaction: async (postId, userId) => {
    try {
      const result = await pool.query(
        'SELECT type FROM reactions WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].type;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user reaction:', error);
      return null;
    }
  }
};

module.exports = postMethods;