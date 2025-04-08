/**
 * Authentication related functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    // Set up logout button event
    setupLogout();
    
    // Check authentication state and redirect if needed
    checkAuthState();
    
    // Setup Socket.io connection if user is logged in
    setupSocket();
});

// Check if user is authenticated and redirect accordingly
function checkAuthState() {
    const currentPath = window.location.pathname;
    const token = localStorage.getItem('token');
    
    // Pages that don't require authentication
    const publicPages = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
    const isPublicPage = publicPages.includes(currentPath);
    
    if (!token && !isPublicPage) {
        // Redirect to login if not authenticated and on a protected page
        window.location.href = '/';
        return;
    }
    
    if (token && isPublicPage && currentPath !== '/forgot-password' && currentPath !== '/reset-password') {
        // If authenticated and on a public page, verify token validity
        fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token is valid, redirect to home
                window.location.href = '/home';
            } else {
                // Token is invalid, clear it
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(error => {
            console.error('Auth check error:', error);
            // Clear token on error
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
    }
}

// Initialize Socket.io connection
let socket = null;

function setupSocket() {
    if (!isLoggedIn()) return;
    
    const token = getToken();
    
    // Connect to socket.io with authentication
    socket = io({
        auth: {
            token: token
        }
    });
    
    // Handle connection
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    // Handle connection error
    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        
        if (error.message === 'Authentication error') {
            // Authentication failed, logout
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });
    
    // Listen for new notifications
    socket.on('new_notification', (data) => {
        // Update notification badge
        updateNotificationBadge();
        
        // Show toast notification
        let message;
        
        switch (data.type) {
            case 'message':
                message = `New message from ${data.senderName}`;
                break;
            case 'reaction':
                message = `${data.senderName} reacted to your post or message`;
                break;
            case 'comment':
                message = `${data.senderName} commented on your post`;
                break;
            case 'transfer':
                message = `${data.senderName} sent you coins`;
                break;
            default:
                message = 'You have a new notification';
        }
        
        showToast('New Notification', message);
    });
    
    // Listen for balance updates
    socket.on('balance_update', (data) => {
        // Refresh user data
        refreshUserData();
        
        // Show toast notification
        showToast('Balance Updated', `${data.senderName} sent you coins`);
    });
    
    // Export socket for other modules to use
    window.socket = socket;
}

// Get user notifications and update badge
function updateNotificationBadge() {
    if (!isLoggedIn() || !socket) return;
    
    socket.emit('get_notifications', {}, (response) => {
        if (response.success) {
            const unreadCount = response.notifications.filter(n => !n.isRead).length;
            const badge = document.getElementById('notificationBadge');
            
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    });
}

// Refresh current user data from the server
async function refreshUserData() {
    try {
        const data = await fetchWithAuth('/api/auth/me');
        
        if (data.user) {
            // Update stored user data
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Update UI elements
            updateUserUI(data.user);
        }
    } catch (error) {
        console.error('Error refreshing user data:', error);
    }
}

// Update UI elements with user data
function updateUserUI(user) {
    // Update balance displays
    const balanceElements = document.querySelectorAll('#balanceAmount, #profileBalance, #senderBalance');
    balanceElements.forEach(el => {
        if (el) el.textContent = user.balance;
    });
    
    // Update avatar
    const avatarElements = document.querySelectorAll('#userAvatar, #profileAvatar');
    avatarElements.forEach(el => {
        if (el) el.src = user.avatar;
    });
    
    // Update username
    const usernameElements = document.querySelectorAll('#profileUsername, #settingsUsername');
    usernameElements.forEach(el => {
        if (el) el.textContent = user.username;
    });
}
