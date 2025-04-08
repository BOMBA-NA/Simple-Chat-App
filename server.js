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
    // Setup chat socket handlers for authenticated users only
    chatSocket(io, socket);
    
    // Setup notifications socket handlers for authenticated users only
    notificationsSocket(io, socket);
  }
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
