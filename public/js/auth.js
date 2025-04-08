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
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Check if we have an old MongoDB ObjectId (24 characters, hex) 
    // that won't work with PostgreSQL's integer IDs
    if (user && user.id && typeof user.id === 'string' && /^[0-9a-fA-F]{24}$/.test(user.id)) {
        // We have a MongoDB ObjectId that won't work with PostgreSQL
        console.log('Detected MongoDB ObjectId, clearing local storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
            window.location.href = '/';
            return;
        }
    }
    
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
                return response.json().then(data => {
                    // Make sure we have a valid user with numeric ID for PostgreSQL
                    if (data.user && data.user.id && !isNaN(parseInt(data.user.id))) {
                        window.location.href = '/home';
                    } else {
                        // User data is not compatible with PostgreSQL
                        console.log('User data not compatible with PostgreSQL');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    }
                });
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
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Check for MongoDB ObjectID before connecting
    if (user && user.id && typeof user.id === 'string' && /^[0-9a-fA-F]{24}$/.test(user.id)) {
        console.log('Detected MongoDB ObjectId in user data, clearing local storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
    }
    
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
            const mobileBadge = document.getElementById('mobileNotificationBadge');
            
            // Update desktop badge
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
            
            // Update mobile badge
            if (mobileBadge) {
                if (unreadCount > 0) {
                    mobileBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    mobileBadge.style.display = 'inline';
                } else {
                    mobileBadge.style.display = 'none';
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
    
    // Show admin link if user has admin role
    const adminLinks = document.querySelectorAll('.admin-only');
    adminLinks.forEach(el => {
        if (el) {
            if (user.role === 'admin') {
                el.style.display = 'block';
            } else {
                el.style.display = 'none';
            }
        }
    });
    
    // Update status dropdown if it exists
    const statusDropdown = document.getElementById('userStatusDropdown');
    if (statusDropdown) {
        // Select the current status in the dropdown
        const currentStatus = user.onlineStatus || 'online';
        const statusOption = statusDropdown.querySelector(`option[value="${currentStatus}"]`);
        if (statusOption) {
            statusOption.selected = true;
        }
    }
}

// Get authentication token
function getToken() {
    return localStorage.getItem('token');
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// Get current user from localStorage
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        console.error('Error parsing user data:', e);
        return {};
    }
}

// Helper function for authenticated fetch requests
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token) {
        throw new Error('No authentication token found');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {})
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Authentication failed');
    }
    
    return response.json();
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(container);
    }
    
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast show`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="toast-header">
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        const toastElement = document.getElementById(toastId);
        if (toastElement) {
            toastElement.remove();
        }
    }, 5000);
}

// Set up the online status dropdown
document.addEventListener('DOMContentLoaded', function() {
    // Add a user status dropdown to the navbar if it doesn't exist
    const navbarNav = document.querySelector('.navbar-nav');
    
    if (navbarNav && !document.getElementById('userStatusDropdown')) {
        // Create status dropdown container
        const statusDropdownContainer = document.createElement('li');
        statusDropdownContainer.className = 'nav-item dropdown ms-2';
        
        // Create status dropdown HTML
        statusDropdownContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-sm dropdown-toggle d-flex align-items-center" type="button" id="statusDropdownBtn" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="status-indicator status-online me-2"></span>
                    <span class="d-none d-md-inline">Status</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="statusDropdownBtn">
                    <li class="px-3 py-1"><h6 class="dropdown-header">Set your status</h6></li>
                    <li>
                        <select id="userStatusDropdown" class="form-select form-select-sm">
                            <option value="online">🟢 Online</option>
                            <option value="away">🟠 Away</option>
                            <option value="busy">🔴 Busy</option>
                            <option value="offline">⚫ Appear Offline</option>
                        </select>
                    </li>
                </ul>
            </div>
        `;
        
        navbarNav.appendChild(statusDropdownContainer);
        
        // Add event listener to the status dropdown
        const statusDropdown = document.getElementById('userStatusDropdown');
        if (statusDropdown) {
            statusDropdown.addEventListener('change', function() {
                const newStatus = this.value;
                
                // Update status indicator in the button
                const statusIndicator = document.querySelector('#statusDropdownBtn .status-indicator');
                if (statusIndicator) {
                    statusIndicator.className = `status-indicator status-${newStatus} me-2`;
                }
                
                // Send status update to server if socket is available
                if (socket) {
                    socket.emit('set_status', { status: newStatus });
                    
                    // Show a toast notification
                    const statusEmojis = {
                        'online': '🟢',
                        'away': '🟠',
                        'busy': '🔴',
                        'offline': '⚫'
                    };
                    
                    const statusMessages = {
                        'online': 'You are now online and visible to everyone',
                        'away': 'You are now set as away',
                        'busy': 'You are now set as busy/do not disturb',
                        'offline': 'You now appear offline to others'
                    };
                    
                    showToast('Status Updated', `${statusEmojis[newStatus]} ${statusMessages[newStatus]}`);
                    
                    // Update the current user object
                    const user = getCurrentUser();
                    if (user) {
                        user.onlineStatus = newStatus;
                        localStorage.setItem('user', JSON.stringify(user));
                    }
                }
            });
        }
    }
});
