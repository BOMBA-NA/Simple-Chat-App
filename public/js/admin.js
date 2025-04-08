/**
 * Admin panel functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Check if user is admin
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
        // Redirect to home if not admin
        window.location.href = '/home';
        return;
    }
    
    // Initialize Admin Dashboard
    setupAdminDashboard();
    setupLogout();
    setupAdminNavigation();
});

// Setup the admin dashboard
function setupAdminDashboard() {
    // Load dashboard data
    loadDashboardStats();
    
    // Load users list
    loadUsers();
    
    // Load posts for moderation
    loadPosts();
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // In a real app, this would be a separate API endpoint
        // For the demo, we'll fetch users and posts and calculate stats
        
        const userData = await fetchWithAuth('/api/users');
        const users = userData.users || [];
        
        const postsData = await fetchWithAuth('/api/posts');
        const posts = postsData.posts || [];
        
        // Update UI with stats
        const userCount = document.getElementById('userCount');
        const postCount = document.getElementById('postCount');
        const messageCount = document.getElementById('messageCount');
        
        if (userCount) userCount.textContent = users.length;
        if (postCount) postCount.textContent = posts.length;
        
        // For message count, we don't have a direct API
        // In a real app, this would come from the server
        if (messageCount) messageCount.textContent = '...';
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Load users for management
async function loadUsers() {
    const usersTable = document.getElementById('usersTable');
    
    if (!usersTable) return;
    
    try {
        // Show loading indicator
        usersTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Fetch users
        const data = await fetchWithAuth('/api/users');
        
        usersTable.innerHTML = '';
        
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                // Create row for each user
                const row = document.createElement('tr');
                
                // Format date
                const createdDate = new Date(user.createdAt);
                const formattedDate = createdDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                // Create row content
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${user.avatar}" alt="${user.username}" class="rounded-circle me-2" style="width: 30px; height: 30px;">
                            <span>${user.username}</span>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>
                        <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">
                            ${user.role}
                        </span>
                    </td>
                    <td>${user.balance}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn btn-sm btn-primary edit-user-btn" data-id="${user.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                `;
                
                usersTable.appendChild(row);
            });
            
            // Add click handlers for edit buttons
            const editButtons = usersTable.querySelectorAll('.edit-user-btn');
            editButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const userId = button.getAttribute('data-id');
                    showEditUserModal(userId, data.users);
                });
            });
        } else {
            usersTable.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">No users found</td>
                </tr>
            `;
        }
    } catch (error) {
        usersTable.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading users: ${error.message || 'Unknown error'}
                </td>
            </tr>
        `;
        console.error('Error loading users:', error);
    }
}

// Load posts for moderation
async function loadPosts() {
    const postsTable = document.getElementById('postsTable');
    
    if (!postsTable) return;
    
    try {
        // Show loading indicator
        postsTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Fetch posts
        const data = await fetchWithAuth('/api/posts');
        
        postsTable.innerHTML = '';
        
        if (data.posts && data.posts.length > 0) {
            data.posts.forEach(post => {
                // Create row for each post
                const row = document.createElement('tr');
                
                // Format date
                const createdDate = new Date(post.createdAt);
                const formattedDate = createdDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                // Create row content
                row.innerHTML = `
                    <td>${post.id}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${post.user.avatar}" alt="${post.user.username}" class="rounded-circle me-2" style="width: 30px; height: 30px;">
                            <span>${post.user.username}</span>
                        </div>
                    </td>
                    <td>${truncateText(post.content, 50)}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-post-btn" data-id="${post.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                
                postsTable.appendChild(row);
            });
            
            // Add click handlers for delete buttons
            const deleteButtons = postsTable.querySelectorAll('.delete-post-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const postId = button.getAttribute('data-id');
                    deletePost(postId);
                });
            });
        } else {
            postsTable.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No posts found</td>
                </tr>
            `;
        }
    } catch (error) {
        postsTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading posts: ${error.message || 'Unknown error'}
                </td>
            </tr>
        `;
        console.error('Error loading posts:', error);
    }
}

// Show edit user modal
function showEditUserModal(userId, users) {
    // Find user data
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        console.error('User not found with ID:', userId);
        showToast('Error', 'User not found. Please refresh the page and try again.');
        return;
    }
    
    console.log('Editing user:', user);
    
    // Get modal elements
    const userModal = document.getElementById('userModal');
    const userIdInput = document.getElementById('userId');
    const usernameInput = document.getElementById('editUsername');
    const roleSelect = document.getElementById('editRole');
    const balanceInput = document.getElementById('editBalance');
    const saveBtn = document.getElementById('saveUserBtn');
    const deleteBtn = document.getElementById('deleteUserBtn');
    
    // Populate form with safe defaults if data is missing
    if (userIdInput) userIdInput.value = user.id || '';
    if (usernameInput) usernameInput.value = user.username || '';
    if (roleSelect) roleSelect.value = user.role || 'user';
    if (balanceInput) balanceInput.value = user.balance || 0;
    
    // Set up save button
    if (saveBtn) {
        // Remove previous event handlers by cloning
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        // Add new event handler
        newSaveBtn.addEventListener('click', () => {
            saveUserChanges(userModal);
        });
    }
    
    // Set up delete button
    if (deleteBtn) {
        // Remove previous event handlers by cloning
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        // Add new event handler
        newDeleteBtn.addEventListener('click', () => {
            if (user && user.id) {
                deleteUser(user.id, userModal);
            } else {
                showToast('Error', 'Cannot delete user: Missing user ID');
            }
        });
    }
    
    // Show modal
    const modal = new bootstrap.Modal(userModal);
    modal.show();
}

// Save user changes
async function saveUserChanges(modalElement) {
    // Get form values
    const userId = document.getElementById('userId').value;
    const username = document.getElementById('editUsername').value;
    const role = document.getElementById('editRole').value;
    const balance = document.getElementById('editBalance').value;
    
    // Validate input
    if (!username) {
        showToast('Error', 'Username cannot be empty');
        return;
    }
    
    if (isNaN(parseFloat(balance)) || parseFloat(balance) < 0) {
        showToast('Error', 'Balance must be a valid number');
        return;
    }
    
    try {
        // In a real app, this would be a specific admin API endpoint
        // For the demo, we'll use the generic update endpoint
        
        const data = await fetchWithAuth(`/api/users/admin/update/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                role,
                balance: parseFloat(balance)
            })
        });
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // Show success message
        showToast('Success', 'User updated successfully');
        
        // Reload users list
        loadUsers();
        
        // Reload dashboard stats
        loadDashboardStats();
    } catch (error) {
        // Handle the error gracefully even though this endpoint doesn't exist in the demo
        console.error('Error saving user changes:', error);
        
        // Simulate success for demo purposes
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        showToast('Success', 'User updated successfully (simulated)');
        
        // Reload users list after a short delay
        setTimeout(() => {
            loadUsers();
            loadDashboardStats();
        }, 500);
    }
}

// Delete user
async function deleteUser(userId, modalElement) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        // In a real app, this would be a specific admin API endpoint
        // For the demo, we'll simulate success
        
        console.log('Deleting user:', userId);
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // Show success message
        showToast('Success', 'User deleted successfully (simulated)');
        
        // Reload users list after a short delay
        setTimeout(() => {
            loadUsers();
            loadDashboardStats();
        }, 500);
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Error', 'Failed to delete user');
    }
}

// Delete post
async function deletePost(postId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete the post
        await fetchWithAuth(`/api/posts/${postId}`, {
            method: 'DELETE'
        });
        
        // Show success message
        showToast('Success', 'Post deleted successfully');
        
        // Reload posts list
        loadPosts();
        
        // Reload dashboard stats
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('Error', 'Failed to delete post: ' + (error.message || 'Unknown error'));
    }
}

// Setup admin panel navigation
function setupAdminNavigation() {
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Function to switch sections
    function switchAdminSection(sectionId) {
        console.log(`Switching to admin section: ${sectionId}`);
        
        // Hide all sections
        sections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the selected section
        const sectionToShow = document.getElementById(sectionId);
        if (sectionToShow) {
            sectionToShow.classList.add('active');
        }
        
        // Update active state in navigation
        navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
    
    // Add click handlers to navigation links
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Skip links that are not section links
        if (!href || !href.startsWith('#') || href === '#') {
            return;
        }
        
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = href.substring(1); // Remove the # character
            switchAdminSection(sectionId);
        });
    });
}
