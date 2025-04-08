// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const postsRoutes = require('./routes/posts');

// Socket handlers
const chatSocket = require('./socket/chat');
const notificationsSocket = require('./socket/notifications');

// Middleware
const authMiddleware = require('./middleware/auth');

// Database
// Use environment variable to determine which database to use (MongoDB or PostgreSQL)
let db;
if (process.env.USE_PG === 'true') {
  // PostgreSQL database
  console.log('Using PostgreSQL database');
  db = require('./models/pgAdapter');
} else {
  // MongoDB database
  console.log('Using MongoDB database');
  db = require('./models/database');
}

// Initialize app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Set routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);

// Serve HTML files
app.get('/', (req, res) => {
  // Clear any existing token cookie to force re-login with PostgreSQL
  res.clearCookie('token');
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/register', (req, res) => {
  // Clear any existing token cookie
  res.clearCookie('token');
  res.sendFile(path.join(__dirname, 'views/register.html'));
});

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/reset-password.html'));
});

app.get('/home', authMiddleware.verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});

app.get('/admin', authMiddleware.verifyToken, authMiddleware.isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    // Allow connection without authentication, but mark as unauthenticated
    socket.user = { id: socket.id, isAuthenticated: false };
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Handle possible MongoDB ID vs PostgreSQL ID issue
    let userId = decoded.id;
    if (typeof userId === 'string') {
      // If this is a MongoDB ObjectId style string
      if (/^[0-9a-fA-F]{24}$/.test(userId)) {
        console.log('Socket auth: MongoDB ObjectId detected, cannot use with PostgreSQL');
        socket.user = { id: socket.id, isAuthenticated: false };
        return next();
      }
      // If it's a numeric string, convert to number
      userId = parseInt(userId, 10);
      if (isNaN(userId)) {
        console.log('Socket auth: Invalid user ID format');
        socket.user = { id: socket.id, isAuthenticated: false };
        return next();
      }
    }
    
    // Verify the user exists in the database
    const user = await db.users.findById(userId);
    if (!user) {
      console.log('Socket auth: User not found in database');
      socket.user = { id: socket.id, isAuthenticated: false };
      return next();
    }
    
    // Assign the user object with numeric ID to ensure compatibility
    socket.user = { 
      ...decoded,
      id: user.id, // Use the numeric ID from the database
      isAuthenticated: true 
    };
    next();
  } catch (err) {
    console.error('Socket authentication error:', err);
    // Allow connection without authentication, but mark as unauthenticated
    socket.user = { id: socket.id, isAuthenticated: false };
    return next();
  }
});

// Socket.io connections
io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  if (socket.user && socket.user.isAuthenticated) {
    // Track user connection status
    const userId = socket.user.id;
    
    try {
      // Update user status to online
      const updatedUser = await db.users.updateOnlineStatus(userId, 'online');
      
      if (updatedUser) {
        // Broadcast to all clients that this user is now online
        io.emit('user_status_change', {
          userId: updatedUser.id,
          username: updatedUser.username,
          status: 'online',
          isAdmin: updatedUser.isAdmin
        });
      }
      
      // Setup chat socket handlers for authenticated users only
      chatSocket(io, socket);
      
      // Setup notifications socket handlers for authenticated users only
      notificationsSocket(io, socket);
      
      // Handle manual status changes
      socket.on('set_status', async (data) => {
        if (data && data.status && ['online', 'away', 'busy', 'offline'].includes(data.status)) {
          try {
            const updatedUser = await db.users.updateOnlineStatus(userId, data.status);
            
            if (updatedUser) {
              // Broadcast to all clients
              io.emit('user_status_change', {
                userId: updatedUser.id,
                username: updatedUser.username,
                status: data.status,
                isAdmin: updatedUser.isAdmin
              });
            }
          } catch (error) {
            console.error('Error updating status:', error);
          }
        }
      });
      
      // Set up a heartbeat to keep track of active users
      const heartbeatInterval = setInterval(async () => {
        try {
          await db.users.updateLastActive(userId);
        } catch (error) {
          console.error('Error updating last active:', error);
        }
      }, 30000); // Every 30 seconds
      
      // Clean up on disconnect
      socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
        
        // Mark user as offline after a delay to handle quick reconnects
        setTimeout(async () => {
          try {
            const user = await db.users.findById(userId);
            // If user hasn't reconnected within 1 minute, mark as offline
            if (user && new Date() - new Date(user.lastActive) > 60000) {
              const updatedUser = await db.users.updateOnlineStatus(userId, 'offline');
              
              if (updatedUser) {
                io.emit('user_status_change', {
                  userId: updatedUser.id,
                  username: updatedUser.username,
                  status: 'offline',
                  isAdmin: updatedUser.isAdmin
                });
              }
            }
          } catch (error) {
            console.error('Error handling disconnect:', error);
          }
        }, 60000); // Wait 1 minute before marking offline
        
        console.log(`User disconnected: ${socket.id}`);
      });
    } catch (error) {
      console.error('Error in socket connection setup:', error);
    }
  } else {
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  }
});

// Create admin user if it doesn't exist and start server
(async () => {
  try {
    // Initialize PostgreSQL database if needed
    if (process.env.USE_PG === 'true') {
      console.log('Connecting to PostgreSQL...');
      const connected = await db.connectToDB();
      if (!connected) {
        console.error('Could not connect to PostgreSQL database');
        process.exit(1);
      }
      
      console.log('Initializing PostgreSQL database schema...');
      await db.initializeDatabase();
    }
    
    // Create admin user
    await db.createAdminUser();
    console.log('Admin user setup complete');
    
    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
})();
