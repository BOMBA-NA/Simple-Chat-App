/**
 * Settings functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize Settings
    setupSettings();
});

// Setup the settings page
function setupSettings() {
    // Get necessary DOM elements
    const settingsTab = document.getElementById('settingsTab');
    const settingsForm = document.getElementById('settingsForm');
    const changePasswordForm = document.getElementById('changePasswordForm');
    
    // Load settings when the settings tab is clicked
    if (settingsTab) {
        settingsTab.addEventListener('click', (e) => {
            e.preventDefault();
            loadSettings();
        });
    }
    
    // Also load settings when clicking the mobile nav settings icon
    const settingsNavItem = document.querySelector('.mobile-nav-item[data-section="settingsSection"]');
    if (settingsNavItem) {
        settingsNavItem.addEventListener('click', () => {
            loadSettings();
        });
    }
    
    // Handle settings form submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveSettings();
        });
    }
    
    // Handle change password form submission
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            changePassword();
        });
    }
}

// Load settings data
function loadSettings() {
    // Get current user data
    const user = getCurrentUser();
    
    if (!user) return;
    
    // Update settings form
    const settingsUsername = document.getElementById('settingsUsername');
    const settingsAvatar = document.getElementById('settingsAvatar');
    
    if (settingsUsername) settingsUsername.value = user.username;
    if (settingsAvatar) settingsAvatar.value = user.avatar;
}

// Save user settings
async function saveSettings() {
    const settingsUsername = document.getElementById('settingsUsername');
    const settingsAvatar = document.getElementById('settingsAvatar');
    
    if (!settingsUsername || !settingsAvatar) return;
    
    const username = settingsUsername.value.trim();
    const avatar = settingsAvatar.value.trim();
    
    // Validate input
    if (!username) {
        showToast('Error', 'Username cannot be empty');
        return;
    }
    
    try {
        // Create updates object
        const updates = {
            username
        };
        
        // Only include avatar if it's not empty
        if (avatar) {
            updates.avatar = avatar;
        }
        
        // Send update request
        const data = await fetchWithAuth('/api/users/profile', {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        // Update user data in localStorage
        if (data.user) {
            const currentUser = getCurrentUser();
            const updatedUser = {
                ...currentUser,
                ...data.user
            };
            
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            // Update UI elements
            updateUserUI(updatedUser);
        }
        
        showToast('Success', 'Profile updated successfully');
    } catch (error) {
        handleApiError(error, 'Failed to update profile');
    }
}

// Change user password
async function changePassword() {
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    if (!currentPassword || !newPassword || !confirmPassword) return;
    
    const currentPwd = currentPassword.value;
    const newPwd = newPassword.value;
    const confirmPwd = confirmPassword.value;
    
    // Validate input
    if (!currentPwd || !newPwd || !confirmPwd) {
        showToast('Error', 'All fields are required');
        return;
    }
    
    if (newPwd.length < 6) {
        showToast('Error', 'Password must be at least 6 characters long');
        return;
    }
    
    if (newPwd !== confirmPwd) {
        showToast('Error', 'Passwords do not match');
        return;
    }
    
    try {
        // Get current user email
        const user = getCurrentUser();
        
        if (!user || !user.email) {
            showToast('Error', 'User information is missing');
            return;
        }
        
        // First, verify current password by attempting a login
        const loginData = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: user.email,
                password: currentPwd
            })
        }).then(res => res.json());
        
        // Check if login was successful
        if (!loginData.token) {
            showToast('Error', 'Current password is incorrect');
            return;
        }
        
        // Simulate password change
        // Note: In a real app, there would be a specific API endpoint for changing password
        // For this demo, we'll use the reset password endpoint with a workaround
        
        // Request a password reset token
        const resetRequest = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: user.email
            })
        }).then(res => res.json());
        
        // Use the reset token to set the new password
        if (resetRequest.resetToken) {
            const resetData = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: resetRequest.resetToken,
                    newPassword: newPwd
                })
            }).then(res => res.json());
            
            if (resetData.message === 'Password reset successful') {
                // Clear form
                currentPassword.value = '';
                newPassword.value = '';
                confirmPassword.value = '';
                
                showToast('Success', 'Password changed successfully');
            } else {
                showToast('Error', resetData.message || 'Failed to change password');
            }
        } else {
            showToast('Error', 'Failed to initiate password change');
        }
    } catch (error) {
        handleApiError(error, 'Failed to change password');
    }
}
