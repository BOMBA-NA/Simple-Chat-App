/**
 * Leaderboard functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize Leaderboard
    setupLeaderboard();
});

// Setup the leaderboard page
function setupLeaderboard() {
    // Get necessary DOM elements
    const leaderboardTab = document.getElementById('leaderboardTab');
    const leaderboardTable = document.getElementById('leaderboardTable');
    
    // Load leaderboard when the leaderboard tab is clicked
    if (leaderboardTab) {
        leaderboardTab.addEventListener('click', (e) => {
            e.preventDefault();
            loadLeaderboard();
        });
    }
    
    // Also load leaderboard when clicking the mobile nav leaderboard icon
    const leaderboardNavItem = document.querySelector('.mobile-nav-item[data-section="leaderboardSection"]');
    if (leaderboardNavItem) {
        leaderboardNavItem.addEventListener('click', () => {
            loadLeaderboard();
        });
    }
    
    // Listen for balance updates to refresh the leaderboard
    document.addEventListener('money-sent', () => {
        loadLeaderboard();
    });
}

// Load leaderboard data
async function loadLeaderboard() {
    const leaderboardTable = document.getElementById('leaderboardTable');
    
    if (!leaderboardTable) return;
    
    try {
        // Show loading indicator
        leaderboardTable.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </td>
            </tr>
        `;
        
        // Fetch leaderboard data
        const data = await fetchWithAuth('/api/users/leaderboard/rankings');
        
        // Get current user ID for highlighting
        const currentUser = getCurrentUser();
        const currentUserId = currentUser ? currentUser.id : null;
        
        // Clear and repopulate the table
        leaderboardTable.innerHTML = '';
        
        if (data.leaderboard && data.leaderboard.length > 0) {
            data.leaderboard.forEach((user, index) => {
                // Create table row
                const isCurrentUser = user.id === currentUserId;
                const rank = index + 1;
                
                // Get rank icon
                let rankIcon = '';
                if (rank === 1) {
                    rankIcon = '<i class="fas fa-trophy text-warning me-2"></i>';
                } else if (rank === 2) {
                    rankIcon = '<i class="fas fa-trophy text-secondary me-2"></i>';
                } else if (rank === 3) {
                    rankIcon = '<i class="fas fa-trophy text-danger me-2"></i>';
                }
                
                // Create table row
                const row = createElement('tr', { 
                    className: isCurrentUser ? 'table-primary' : '',
                    id: `leaderboard-row-${user.id}`
                }, [
                    // Rank column
                    createElement('td', {}, [
                        createElement('span', { 
                            className: 'fw-bold',
                            innerHTML: rankIcon + rank
                        })
                    ]),
                    
                    // User column
                    createElement('td', {}, [
                        createElement('div', { className: 'd-flex align-items-center' }, [
                            createElement('img', { 
                                src: user.avatar, 
                                alt: user.username, 
                                className: 'rounded-circle me-2',
                                style: { width: '30px', height: '30px' }
                            }),
                            createElement('span', {}, user.username)
                        ])
                    ]),
                    
                    // Balance column
                    createElement('td', {}, [
                        createElement('span', { className: 'fw-bold' }, [
                            createElement('i', { className: 'fas fa-coins text-warning me-1' }),
                            createElement('span', {}, user.balance)
                        ])
                    ]),
                    
                    // Action column
                    createElement('td', {}, [
                        isCurrentUser ? 
                            createElement('span', { className: 'text-muted' }, 'You') :
                            createElement('button', { 
                                className: 'btn btn-sm btn-outline-primary',
                                onclick: () => showSendMoneyModal(user.id, user.username)
                            }, [
                                createElement('i', { className: 'fas fa-coins me-1' }),
                                createElement('span', {}, 'Send')
                            ])
                    ])
                ]);
                
                leaderboardTable.appendChild(row);
            });
        } else {
            leaderboardTable.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        <p>No users found</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        leaderboardTable.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <p class="text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error loading leaderboard
                    </p>
                </td>
            </tr>
        `;
        handleApiError(error, 'Failed to load leaderboard');
    }
}
