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
const db = require('./models/database');

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
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.get('/register', (req, res) => {
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
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    // Allow connection without authentication, but mark as unauthenticated
    socket.user = { id: socket.id, isAuthenticated: false };
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = { ...decoded, isAuthenticated: true };
    next();
  } catch (err) {
    // Allow connection without authentication, but mark as unauthenticated
    socket.user = { id: socket.id, isAuthenticated: false };
    return next();
  }
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  if (socket.user && socket.user.isAuthenticated) {
    // Track user connection status
    const userId = socket.user.id;
    
    // Update user status to online
    const updatedUser = db.users.updateOnlineStatus(userId, 'online');
    
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
    socket.on('set_status', (data) => {
      if (data && data.status && ['online', 'away', 'busy', 'offline'].includes(data.status)) {
        const updatedUser = db.users.updateOnlineStatus(userId, data.status);
        
        if (updatedUser) {
          // Broadcast to all clients
          io.emit('user_status_change', {
            userId: updatedUser.id,
            username: updatedUser.username,
            status: data.status,
            isAdmin: updatedUser.isAdmin
          });
        }
      }
    });
    
    // Set up a heartbeat to keep track of active users
    const heartbeatInterval = setInterval(() => {
      db.users.updateLastActive(userId);
    }, 30000); // Every 30 seconds
    
    // Clean up on disconnect
    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
      
      // Mark user as offline after a delay to handle quick reconnects
      setTimeout(() => {
        const user = db.users.findById(userId);
        // If user hasn't reconnected within 1 minute, mark as offline
        if (user && new Date() - new Date(user.lastActive) > 60000) {
          const updatedUser = db.users.updateOnlineStatus(userId, 'offline');
          
          if (updatedUser) {
            io.emit('user_status_change', {
              userId: updatedUser.id,
              username: updatedUser.username,
              status: 'offline',
              isAdmin: updatedUser.isAdmin
            });
          }
        }
      }, 60000); // Wait 1 minute before marking offline
      
      console.log(`User disconnected: ${socket.id}`);
    });
  } else {
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  }
});

// Create admin user if it doesn't exist
db.createAdminUser();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
