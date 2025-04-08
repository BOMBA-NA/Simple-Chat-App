/**
 * Utility functions for ArcadeTalk
 */

// Show toast notification
function showToast(title, message, duration = 3000) {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (toast && toastTitle && toastMessage) {
        toastTitle.textContent = title;
        toastMessage.textContent = message;
        
        const bsToast = new bootstrap.Toast(toast, {
            delay: duration
        });
        bsToast.show();
    }
}

// Format date for display
function formatDate(dateString) {
    // Check if dateString is valid
    if (!dateString) return 'unknown date';
    
    try {
        const date = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'invalid date';
        }
        
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) {
            return 'just now';
        } else if (diffMin < 60) {
            return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        } else if (diffHour < 24) {
            return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        } else if (diffDay < 7) {
            return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'date error';
    }
}

// Format time for display in chat
function formatTime(dateString) {
    if (!dateString) return 'unknown time';
    
    try {
        const date = new Date(dateString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'invalid time';
        }
        
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting time:', error);
        return 'time error';
    }
}

// Get current user from localStorage
function getCurrentUser() {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
}

// Get auth token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Check if user is logged in
function isLoggedIn() {
    return !!getToken();
}

// Handle API errors and display toast
function handleApiError(error, defaultMessage = 'An error occurred') {
    console.error('API Error:', error);
    let errorMessage = defaultMessage;
    
    if (error.response && error.response.data && error.response.data.message) {
        errorMessage = error.response.data.message;
    } else if (error.message) {
        errorMessage = error.message;
    }
    
    showToast('Error', errorMessage);
}

// Fetch API with authorization headers
async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const user = getCurrentUser();
    
    // Check for MongoDB ObjectID before connecting
    if (user && user.id && typeof user.id === 'string' && /^[0-9a-fA-F]{24}$/.test(user.id)) {
        console.log('Detected MongoDB ObjectId in user data, clearing local storage');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        throw new Error('Your session was using MongoDB format IDs which are incompatible with PostgreSQL. Please re-login.');
    }
    
    if (!token) {
        throw new Error('No authentication token available');
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
    
    // Handle unauthorized access
    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        throw new Error('Your session has expired. Please log in again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        // Handle 404 for user not found specifically
        if (response.status === 404 && url.includes('/api/users/') && data.message === 'User not found') {
            console.warn(`User not found: ${data.userId || 'Unknown ID'}`);
            // Optionally redirect or handle gracefully
            // Instead of throwing, we could return a default value or empty object
            return { user: null, notFound: true };
        }
        
        throw {
            status: response.status,
            message: data.message || 'An error occurred',
            response: data
        };
    }
    
    return data;
}

// Create HTML element with attributes and children
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const eventName = key.substring(2).toLowerCase();
            element.addEventListener(eventName, value);
        } else {
            element.setAttribute(key, value);
        }
    }
    
    // Add children
    if (Array.isArray(children)) {
        children.forEach(child => appendChild(element, child));
    } else {
        appendChild(element, children);
    }
    
    return element;
}

// Helper function to append child to element
function appendChild(element, child) {
    if (child === null || child === undefined) return;
    
    if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(child));
    } else {
        element.appendChild(child);
    }
}

// Truncate text to specified length
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Escape HTML to prevent XSS
function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

// Setup logout functionality
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    
    const handleLogout = async (e) => {
        e.preventDefault();
        
        try {
            await fetchWithAuth('/api/auth/logout', {
                method: 'POST'
            });
            
            // Clear local storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Redirect to login page
            window.location.href = '/';
        } catch (error) {
            // Even if the API call fails, log out the user locally
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
    };
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', handleLogout);
    }
}

// Setup mobile navigation
// Initialize function to run on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up mobile navigation if we're on a page that has it
    if (document.querySelector('.mobile-nav') || document.querySelector('.navbar-nav')) {
        setupMobileNav();
    }
});

function setupMobileNav() {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Export the switchSection function to make it available globally
    window.switchSection = switchSection;
    
    // Function to switch active section
    function switchSection(sectionId) {
        console.log(`Switching to section: ${sectionId}`);
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the selected section
        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) {
            sectionToShow.classList.add('active');
        }
        
        // Update mobile nav active state
        mobileNavItems.forEach(item => {
            if (item.dataset.section === sectionId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Update navbar active state
        navLinks.forEach(link => {
            const linkSection = link.id.replace('Tab', 'Section');
            if (linkSection === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Special handling for chat section
        if (sectionId === 'chatSection') {
            // Trigger a resize event to help chat interface adjust
            window.dispatchEvent(new Event('resize'));
            
            // If chat.js has initialized the chat layout, refresh it
            if (typeof refreshChatLayout === 'function') {
                refreshChatLayout();
            }
        }
    }
    
    // Set up mobile nav item click events
    mobileNavItems.forEach(item => {
        // For items with an anchor tag but not actually leaving the page,
        // we still want to handle the click
        const anchor = item.querySelector('a');
        if (anchor && anchor.getAttribute('href') && 
            (anchor.getAttribute('href') === '#' || 
             anchor.getAttribute('href').startsWith('#'))) {
            
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
            });
        }
        
        // Only skip if it's a full page navigation (like to admin page)
        if (item.querySelector('a[href^="/"]')) {
            return;
        }
        
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            if (sectionId) {
                switchSection(sectionId);
            }
        });
    });
    
    // Set up navbar link click events
    navLinks.forEach(link => {
        // Skip links that are actual navigation links (like admin link)
        if (link.getAttribute('href') && link.getAttribute('href').startsWith('/')) {
            return;
        }
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.id.replace('Tab', 'Section');
            switchSection(sectionId);
        });
    });
}
