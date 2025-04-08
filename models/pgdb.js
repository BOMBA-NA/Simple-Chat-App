// PostgreSQL Database Connection Module
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Test database connection
async function connectToDB() {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('PostgreSQL connection error:', err);
    return false;
  }
}

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100),
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        is_admin BOOLEAN DEFAULT FALSE,
        admin_badge BOOLEAN DEFAULT FALSE,
        balance INTEGER DEFAULT 100,
        avatar VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        online_status VARCHAR(20) DEFAULT 'offline',
        is_typing BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Create posts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        like_count INTEGER DEFAULT 0,
        love_count INTEGER DEFAULT 0,
        laugh_count INTEGER DEFAULT 0,
        wow_count INTEGER DEFAULT 0,
        sad_count INTEGER DEFAULT 0,
        angry_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0
      )
    `);
    
    // Create reactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )
    `);
    
    // Create comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE
      )
    `);
    
    // Create message_reactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id SERIAL PRIMARY KEY,
        message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reaction VARCHAR(20) NOT NULL,
        UNIQUE(message_id, user_id)
      )
    `);
    
    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        related_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT FALSE
      )
    `);
    
    await client.query('COMMIT');
    console.log('Database schema initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database schema:', err);
  } finally {
    client.release();
  }
}

// Function to create admin account if it doesn't exist
async function createAdminUser() {
  try {
    // Check if admin user exists
    const result = await pool.query('SELECT * FROM users WHERE username = $1', ['Administrator']);
    
    if (result.rows.length === 0) {
      // Create admin user
      const hashedPassword = bcrypt.hashSync('admin', 10);
      const adminEmail = 'admin@arcadetalk.com';
      
      const adminResult = await pool.query(`
        INSERT INTO users (
          username, 
          display_name, 
          email, 
          password, 
          role, 
          is_admin, 
          admin_badge, 
          balance, 
          avatar, 
          is_active, 
          online_status
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        'Administrator',
        'Administrator',
        adminEmail,
        hashedPassword,
        'admin',
        true,
        true,
        1000,
        'https://ui-avatars.com/api/?name=Administrator&background=8a2be2&color=fff',
        true,
        'online'
      ]);
      
      console.log(`Admin account auto-created: email: "${adminEmail}", name: "Administrator", password: "admin"`);
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

module.exports = {
  pool,
  connectToDB,
  initializeDatabase,
  createAdminUser
};