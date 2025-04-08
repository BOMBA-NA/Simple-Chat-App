/**
 * Profile functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize Profile
    setupProfile();
    
    // Setup event delegation for edit profile
    setupEditProfile();
});

// Setup the profile page
function setupProfile() {
    // Get necessary DOM elements
    const profileTab = document.getElementById('profileTab');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileUsername = document.getElementById('profileUsername');
    const profileBalance = document.getElementById('profileBalance');
    const userPostsContainer = document.getElementById('userPostsContainer');
    
    // Load profile when the profile tab is clicked
    if (profileTab) {
        profileTab.addEventListener('click', (e) => {
            e.preventDefault();
            loadProfile();
        });
    }
    
    // Also load profile when clicking the mobile nav profile icon
    const profileNavItem = document.querySelector('.mobile-nav-item[data-section="profileSection"]');
    if (profileNavItem) {
        profileNavItem.addEventListener('click', () => {
            loadProfile();
        });
    }
}

// Load user profile data
function loadProfile() {
    // Get current user data
    const user = getCurrentUser();
    
    if (!user) return;
    
    // Update profile info
    const profileAvatar = document.getElementById('profileAvatar');
    const profileUsername = document.getElementById('profileUsername');
    const profileBalance = document.getElementById('profileBalance');
    
    if (profileAvatar) profileAvatar.src = user.avatar;
    if (profileUsername) profileUsername.textContent = user.username;
    if (profileBalance) profileBalance.textContent = user.balance;
    
    // Load user posts
    loadUserPosts(user.id);
}

// Load posts for a specific user
async function loadUserPosts(userId) {
    const userPostsContainer = document.getElementById('userPostsContainer');
    
    if (!userPostsContainer) return;
    
    try {
        userPostsContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
        
        const data = await fetchWithAuth(`/api/users/${userId}/posts`);
        
        userPostsContainer.innerHTML = '';
        
        if (data.posts && data.posts.length > 0) {
            data.posts.forEach(post => {
                const postElement = createPostElement(post);
                userPostsContainer.appendChild(postElement);
            });
        } else {
            userPostsContainer.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-newspaper fa-4x text-muted mb-3"></i>
                    <p>No posts yet. Share something on your profile!</p>
                </div>
            `;
        }
    } catch (error) {
        userPostsContainer.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
                <p>Error loading posts. Please try again later.</p>
            </div>
        `;
        handleApiError(error, 'Failed to load user posts');
    }
}

// Set up edit profile functionality
function setupEditProfile() {
    const editProfileBtn = document.getElementById('editProfileBtn');
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            // Switch to settings tab
            const settingsTab = document.getElementById('settingsTab');
            if (settingsTab) {
                settingsTab.click();
            } else {
                // If mobile, use mobile nav
                const settingsNavItem = document.querySelector('.mobile-nav-item[data-section="settingsSection"]');
                if (settingsNavItem) {
                    settingsNavItem.click();
                }
            }
        });
    }
}

// Create a user post element (similar to newsfeed but with fewer features)
function createPostElement(post) {
    // Create date string
    const dateString = formatDate(post.createdAt);
    
    // Create post element
    const postCard = createElement('div', { className: 'card post-card fade-in mb-3' }, [
        // Post header
        createElement('div', { className: 'post-header' }, [
            createElement('img', { 
                src: post.user.avatar, 
                alt: post.user.username, 
                className: 'profile-pic'
            }),
            createElement('div', { className: 'post-user-info' }, [
                createElement('h5', {}, post.user.username),
                createElement('small', {}, dateString)
            ])
        ]),
        
        // Post content
        createElement('div', { className: 'post-content' }, escapeHtml(post.content)),
        
        // Post stats (simplified)
        createElement('div', { className: 'post-actions' }, [
            createElement('div', { className: 'post-stat' }, [
                createElement('i', { className: 'fas fa-thumbs-up me-1' }),
                createElement('span', {}, getReactionCount(post.reactions))
            ]),
            createElement('div', { className: 'post-stat ms-3' }, [
                createElement('i', { className: 'fas fa-comment me-1' }),
                createElement('span', {}, post.commentsCount)
            ])
        ])
    ]);
    
    return postCard;
}

// Get the total count of reactions
function getReactionCount(reactions) {
    if (!reactions) return 0;
    
    return Object.values(reactions).reduce((sum, count) => sum + count, 0);
}
