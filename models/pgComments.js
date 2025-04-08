// PostgreSQL Comments Methods
const { pool } = require('./pgdb');

// Comments methods
const commentMethods = {
  create: async (commentData) => {
    try {
      const result = await pool.query(
        'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
        [commentData.postId, commentData.userId, commentData.content]
      );
      
      if (result.rows.length > 0) {
        const comment = result.rows[0];
        
        // Get user information
        const userResult = await pool.query(
          'SELECT username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [comment.user_id]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          return {
            id: comment.id,
            postId: comment.post_id,
            userId: comment.user_id,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            user: {
              id: comment.user_id,
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
      console.error('Error creating comment:', error);
      return null;
    }
  },
  
  getByPostId: async (postId) => {
    try {
      const result = await pool.query(
        'SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at',
        [postId]
      );
      
      const comments = [];
      
      for (const comment of result.rows) {
        // Get user information for each comment
        const userResult = await pool.query(
          'SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [comment.user_id]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          comments.push({
            id: comment.id,
            postId: comment.post_id,
            userId: comment.user_id,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
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
      
      return comments;
    } catch (error) {
      console.error('Error getting comments by post ID:', error);
      return [];
    }
  },
  
  delete: async (commentId) => {
    try {
      const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [commentId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  },
  
  update: async (commentId, content) => {
    try {
      const result = await pool.query(
        'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [content, commentId]
      );
      
      if (result.rows.length > 0) {
        const comment = result.rows[0];
        
        // Get user information
        const userResult = await pool.query(
          'SELECT id, username, display_name, avatar, is_admin FROM users WHERE id = $1',
          [comment.user_id]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          
          return {
            id: comment.id,
            postId: comment.post_id,
            userId: comment.user_id,
            content: comment.content,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
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
      console.error('Error updating comment:', error);
      return null;
    }
  }
};

module.exports = commentMethods;