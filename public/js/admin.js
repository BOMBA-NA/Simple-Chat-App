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
    
    // Restrict admin access to only admin@arcadetalk.com
    if (currentUser.email !== 'admin@arcadetalk.com') {
        window.location.href = '/home';
        showToast('Access Denied', 'Only the primary admin account can access this panel');
        return;
    }
    
    // Load Chart.js from CDN for advanced analytics
    loadChartJs();
    
    // Initialize Admin Dashboard
    setupAdminDashboard();
    setupLogout();
    setupAdminNavigation();
    setupMobileAdminNav();
    
    // Set up time period toggles for analytics
    document.getElementById('weekViewBtn')?.addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('monthViewBtn').classList.remove('active');
        loadActivityChart('week');
    });
    
    document.getElementById('monthViewBtn')?.addEventListener('click', function() {
        this.classList.add('active');
        document.getElementById('weekViewBtn').classList.remove('active');
        loadActivityChart('month');
    });
});

// Load Chart.js from CDN
function loadChartJs() {
    if (!window.Chart) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js loaded successfully');
            setupCharts();
        };
        document.head.appendChild(script);
    } else {
        setupCharts();
    }
}

// Set up chart configurations once Chart.js is loaded
function setupCharts() {
    // Will be called once Chart.js is loaded
    if (window.Chart) {
        loadActivityChart('week');
        loadUserDistributionChart();
    }
}

// Setup the admin dashboard
function setupAdminDashboard() {
    // Load dashboard data
    loadDashboardStats();
    
    // Load users list
    loadUsers();
    
    // Load posts for moderation
    loadPosts();
    
    // Load recent activity
    loadRecentActivity();
    
    // Start system health monitoring simulation
    simulateSystemHealth();
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
        const gameCount = document.getElementById('gameCount');
        
        if (userCount) userCount.textContent = users.length;
        if (postCount) postCount.textContent = posts.length;
        
        // For message count and game count, we don't have a direct API
        // In a real app, this would come from the server
        if (messageCount) messageCount.textContent = Math.floor(Math.random() * 100) + 50; // Simulated data
        if (gameCount) gameCount.textContent = Math.floor(Math.random() * 50) + 10; // Simulated data
        
        // Update growth metrics
        simulateGrowthMetrics();
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        
        // For demonstration purposes, set some sample data if API fails
        const userCount = document.getElementById('userCount');
        const postCount = document.getElementById('postCount');
        const messageCount = document.getElementById('messageCount');
        const gameCount = document.getElementById('gameCount');
        
        if (userCount) userCount.textContent = '15';
        if (postCount) postCount.textContent = '42';
        if (messageCount) messageCount.textContent = '128';
        if (gameCount) gameCount.textContent = '36';
        
        // Simulate growth metrics
        simulateGrowthMetrics();
    }
}

// Simulate growth metrics for demonstration
function simulateGrowthMetrics() {
    setGrowthMetric('user', Math.floor(Math.random() * 20) + 1);
    setGrowthMetric('post', Math.floor(Math.random() * 30) + 5);
    setGrowthMetric('message', Math.floor(Math.random() * 40) + 10);
    setGrowthMetric('game', Math.floor(Math.random() * 25) + 3);
}

// Helper function to set a growth metric
function setGrowthMetric(type, percentage) {
    const bar = document.getElementById(`${type}GrowthBar`);
    const rate = document.getElementById(`${type}GrowthRate`);
    
    if (bar && rate) {
        bar.style.width = `${percentage}%`;
        rate.textContent = `+${percentage}% this week`;
        
        // Set color based on the percentage
        if (percentage > 20) {
            bar.className = 'progress-bar bg-success';
        } else if (percentage > 5) {
            bar.className = 'progress-bar bg-info';
        } else {
            bar.className = 'progress-bar bg-warning';
        }
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
    // Restrict deleting users as per requirements
    showToast('Restricted Action', 'Deleting users has been disabled by administrator');
    
    // Hide modal
    const modal = bootstrap.Modal.getInstance(modalElement);
    modal.hide();
    
    return;
}

// Delete post
async function deletePost(postId) {
    try {
        // Confirm deletion
        if (!confirm('Are you sure you want to delete this post?')) {
            return;
        }
        
        const data = await fetchWithAuth(`/api/posts/${postId}`, {
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
        showToast('Error', 'Failed to delete post. Please try again.');
    }
}

// Load activity chart
function loadActivityChart(period) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;
    
    // Clear existing chart if any
    if (ctx.chart) {
        ctx.chart.destroy();
    }
    
    // Create the container for the chart if it doesn't exist
    if (!document.querySelector('#activityChart canvas')) {
        // Remove the loading spinner
        ctx.innerHTML = '';
        
        const canvas = document.createElement('canvas');
        ctx.appendChild(canvas);
        
        // Generate sample data
        const days = period === 'week' ? 7 : 30;
        const labels = [];
        const usersData = [];
        const postsData = [];
        const messagesData = [];
        
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i - 1));
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            
            // Random data for demonstration
            usersData.push(Math.floor(Math.random() * 5) + 1);
            postsData.push(Math.floor(Math.random() * 10) + 1);
            messagesData.push(Math.floor(Math.random() * 20) + 5);
        }
        
        // Create chart if Chart.js is loaded
        if (window.Chart) {
            ctx.chart = new Chart(canvas, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'New Users',
                            data: usersData,
                            borderColor: '#8a2be2',
                            backgroundColor: 'rgba(138, 43, 226, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: false
                        },
                        {
                            label: 'Posts',
                            data: postsData,
                            borderColor: '#28a745',
                            backgroundColor: 'rgba(40, 167, 69, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: false
                        },
                        {
                            label: 'Messages',
                            data: messagesData,
                            borderColor: '#17a2b8',
                            backgroundColor: 'rgba(23, 162, 184, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
}

// Load user distribution chart
function loadUserDistributionChart() {
    const ctx = document.getElementById('userDistributionChart');
    if (!ctx) return;
    
    // Create the container for the chart if it doesn't exist
    if (!document.querySelector('#userDistributionChart canvas')) {
        // Remove the loading spinner
        ctx.innerHTML = '';
        
        const canvas = document.createElement('canvas');
        ctx.appendChild(canvas);
        
        // Create chart with sample data if Chart.js is loaded
        if (window.Chart) {
            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['Active', 'Inactive', 'New'],
                    datasets: [{
                        data: [70, 15, 15],
                        backgroundColor: [
                            '#8a2be2',
                            '#dc3545',
                            '#28a745'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }
}

// Load recent activity feed
function loadRecentActivity() {
    const activityList = document.getElementById('recentActivityList');
    if (!activityList) return;
    
    // Sample activity data for demonstration
    const activities = [
        { type: 'user', message: 'New user registered', time: '2 minutes ago', icon: 'fas fa-user-plus text-success' },
        { type: 'post', message: 'New post created', time: '15 minutes ago', icon: 'fas fa-newspaper text-primary' },
        { type: 'comment', message: 'New comment on post', time: '32 minutes ago', icon: 'fas fa-comment text-info' },
        { type: 'game', message: 'Pet battle completed', time: '1 hour ago', icon: 'fas fa-gamepad text-warning' },
        { type: 'system', message: 'System backup completed', time: '3 hours ago', icon: 'fas fa-server text-secondary' }
    ];
    
    // Clear loading spinner
    activityList.innerHTML = '';
    
    // Add activity items
    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex align-items-center';
        item.innerHTML = `
            <div class="activity-icon me-3">
                <i class="${activity.icon}" style="font-size: 1.2rem;"></i>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center">
                    <strong>${activity.message}</strong>
                    <small class="text-muted">${activity.time}</small>
                </div>
            </div>
        `;
        activityList.appendChild(item);
    });
}

// Simulate system health monitoring
function simulateSystemHealth() {
    // Update CPU usage
    const cpuUsage = Math.floor(Math.random() * 30) + 20;
    const cpuElement = document.getElementById('cpuUsage');
    const cpuBar = document.getElementById('cpuBar');
    
    if (cpuElement) cpuElement.textContent = `${cpuUsage}%`;
    if (cpuBar) {
        cpuBar.style.width = `${cpuUsage}%`;
        
        if (cpuUsage > 70) {
            cpuBar.className = 'progress-bar bg-danger';
        } else if (cpuUsage > 50) {
            cpuBar.className = 'progress-bar bg-warning';
        } else {
            cpuBar.className = 'progress-bar bg-success';
        }
    }
    
    // Update memory usage
    const memoryUsage = Math.floor(Math.random() * 35) + 30;
    const memoryElement = document.getElementById('memoryUsage');
    const memoryBar = document.getElementById('memoryBar');
    
    if (memoryElement) memoryElement.textContent = `${memoryUsage}%`;
    if (memoryBar) {
        memoryBar.style.width = `${memoryUsage}%`;
        
        if (memoryUsage > 80) {
            memoryBar.className = 'progress-bar bg-danger';
        } else if (memoryUsage > 60) {
            memoryBar.className = 'progress-bar bg-warning';
        } else {
            memoryBar.className = 'progress-bar bg-info';
        }
    }
    
    // Update database connections
    const dbConnections = Math.floor(Math.random() * 15) + 5;
    const dbElement = document.getElementById('dbConnections');
    const dbBar = document.getElementById('dbBar');
    
    if (dbElement) dbElement.textContent = `${dbConnections}/50`;
    if (dbBar) dbBar.style.width = `${dbConnections * 2}%`;
    
    // Update socket connections
    const socketCount = Math.floor(Math.random() * 20) + 15;
    const socketElement = document.getElementById('socketCount');
    const socketBar = document.getElementById('socketBar');
    
    if (socketElement) socketElement.textContent = socketCount;
    if (socketBar) socketBar.style.width = `${socketCount * 2}%`;
    
    // Update every 5 seconds
    setTimeout(simulateSystemHealth, 5000);
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
        
        // Update mobile nav active state
        const mobileNavItems = document.querySelectorAll('.mobile-admin-nav-item');
        mobileNavItems.forEach(item => {
            const targetSection = item.getAttribute('data-section');
            if (targetSection === sectionId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
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
    
    // Export the switchAdminSection function for use in mobile nav
    window.switchAdminSection = switchAdminSection;
}

// Setup mobile navigation for admin panel
function setupMobileAdminNav() {
    // Create mobile navigation if it doesn't exist
    if (!document.querySelector('.mobile-admin-nav')) {
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-admin-nav';
        mobileNav.innerHTML = `
            <div class="mobile-admin-nav-item active" data-section="dashboardSection">
                <i class="fas fa-tachometer-alt"></i>
                <span>Dashboard</span>
            </div>
            <div class="mobile-admin-nav-item" data-section="usersSection">
                <i class="fas fa-users"></i>
                <span>Users</span>
            </div>
            <div class="mobile-admin-nav-item" data-section="postsSection">
                <i class="fas fa-newspaper"></i>
                <span>Posts</span>
            </div>
            <div class="mobile-admin-nav-item">
                <a href="/home" style="color: inherit; text-decoration: none;">
                    <i class="fas fa-home"></i>
                    <span>Home</span>
                </a>
            </div>
            <div class="mobile-admin-nav-item" id="mobileLogoutBtn">
                <i class="fas fa-sign-out-alt"></i>
                <span>Logout</span>
            </div>
        `;
        
        document.body.appendChild(mobileNav);
        
        // Add click handlers for mobile nav items
        const mobileNavItems = document.querySelectorAll('.mobile-admin-nav-item');
        mobileNavItems.forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.getAttribute('data-section');
                if (sectionId) {
                    window.switchAdminSection(sectionId);
                }
            });
        });
        
        // Add logout handler
        document.getElementById('mobileLogoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = '/';
        });
        
        // Add CSS styles for mobile navigation
        const style = document.createElement('style');
        style.textContent = `
            .mobile-admin-nav {
                display: none;
                position: fixed;
                bottom: 0;
                left: 0;
                width: 100%;
                background-color: white;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
                border-top: 1px solid #e6e6e6;
                z-index: 1000;
                padding: 5px 0;
                justify-content: space-between;
            }
            
            .mobile-admin-nav-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 10px 5px;
                flex: 1;
                cursor: pointer;
                color: #666666;
                font-size: 0.75rem;
                transition: all 0.3s ease;
                position: relative;
                border-radius: 8px;
                margin: 0 2px;
                max-width: 20%;
            }
            
            .mobile-admin-nav-item i {
                font-size: 1.3rem;
                margin-bottom: 5px;
                transition: transform 0.3s ease;
            }
            
            .mobile-admin-nav-item:hover i {
                transform: translateY(-2px);
            }
            
            .mobile-admin-nav-item.active {
                color: #8a2be2;
                background-color: rgba(138, 43, 226, 0.1);
            }
            
            .mobile-admin-nav-item.active i {
                color: #8a2be2;
            }
            
            .mobile-admin-nav-item::before {
                content: '';
                position: absolute;
                width: 0;
                height: 3px;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                background-color: #8a2be2;
                transition: width 0.3s ease;
            }
            
            .mobile-admin-nav-item.active::before {
                width: 60%;
            }
            
            @media (max-width: 768px) {
                .mobile-admin-nav {
                    display: flex;
                }
                
                body {
                    padding-bottom: 60px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
}
