
// Handle login form and authentication
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                // Clear previous errors
                errorMessage.style.display = 'none';
                
                // Submit login request
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    // Show error message
                    errorMessage.textContent = data.message || 'Login failed';
                    errorMessage.style.display = 'block';
                    return;
                }
                
                // Save token and user data to localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Redirect to home page
                window.location.href = '/home';
            } catch (error) {
                console.error('Login error:', error);
                errorMessage.textContent = 'An error occurred during login';
                errorMessage.style.display = 'block';
            }
        });
    }
});
