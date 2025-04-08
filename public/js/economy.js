/**
 * Economy system functionality for ArcadeTalk
 * This module handles coin transfers and balance updates
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize economy system
    setupEconomySystem();
});

function setupEconomySystem() {
    // Initialize the user's balance display
    updateBalanceDisplay();
    
    // Setup balance update listeners
    setupBalanceUpdateListeners();
}

// Update all balance displays with the current user's balance
function updateBalanceDisplay() {
    const user = getCurrentUser();
    
    if (!user) return;
    
    // Update all balance displays
    const balanceElements = document.querySelectorAll('#balanceAmount, #profileBalance, #senderBalance');
    
    balanceElements.forEach(element => {
        if (element) {
            element.textContent = user.balance;
        }
    });
}

// Setup listeners for balance updates
function setupBalanceUpdateListeners() {
    // Listen for balance updates via socket
    if (socket) {
        socket.on('balance_update', (data) => {
            refreshUserData();
            showToast('Balance Updated', `${data.senderName} sent you coins!`);
        });
    }
    
    // Update balance when sending money to users in the leaderboard
    document.addEventListener('money-sent', () => {
        refreshUserData();
    });
}

// Send money to another user
async function sendMoney(receiverId, amount, receiverName) {
    if (!receiverId || !amount) {
        showToast('Error', 'Receiver ID and amount are required');
        return { success: false };
    }
    
    try {
        // Convert amount to number and validate
        const transferAmount = parseFloat(amount);
        
        if (isNaN(transferAmount) || transferAmount <= 0) {
            showToast('Error', 'Amount must be a positive number');
            return { success: false };
        }
        
        // Send transfer request
        const data = await fetchWithAuth('/api/users/transfer', {
            method: 'POST',
            body: JSON.stringify({
                receiverId,
                amount: transferAmount
            })
        });
        
        // Update user's balance in localStorage
        const user = getCurrentUser();
        if (user) {
            user.balance = data.balance;
            localStorage.setItem('user', JSON.stringify(user));
        }
        
        // Update UI
        updateBalanceDisplay();
        
        // Show success message
        const message = receiverName
            ? `Successfully sent ${transferAmount} coins to ${receiverName}`
            : data.message;
            
        showToast('Success', message);
        
        // Notify recipient via socket
        if (socket) {
            socket.emit('balance_updated', { receiverId });
        }
        
        // Dispatch event for other components to react
        document.dispatchEvent(new CustomEvent('money-sent', {
            detail: { receiver: receiverId, amount: transferAmount }
        }));
        
        return { success: true, data };
    } catch (error) {
        handleApiError(error, 'Failed to send money');
        return { success: false, error };
    }
}

// Display send money modal
function showSendMoneyModal(userId, username) {
    const sendMoneyModal = document.getElementById('sendMoneyModal');
    const recipientName = document.getElementById('recipientName');
    const transferAmount = document.getElementById('transferAmount');
    const senderBalance = document.getElementById('senderBalance');
    const confirmSendMoneyBtn = document.getElementById('confirmSendMoneyBtn');
    
    if (!sendMoneyModal) return;
    
    // Set recipient name
    if (recipientName) {
        recipientName.textContent = username;
    }
    
    // Set current balance
    const currentUser = getCurrentUser();
    if (senderBalance && currentUser) {
        senderBalance.textContent = currentUser.balance;
    }
    
    // Clear previous amount
    if (transferAmount) {
        transferAmount.value = '';
    }
    
    // Update confirm button
    if (confirmSendMoneyBtn) {
        // Remove previous event listeners by cloning
        const newButton = confirmSendMoneyBtn.cloneNode(true);
        confirmSendMoneyBtn.parentNode.replaceChild(newButton, confirmSendMoneyBtn);
        
        // Add new event listener
        newButton.addEventListener('click', async () => {
            if (!transferAmount) return;
            
            const amount = transferAmount.value.trim();
            
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                showToast('Error', 'Please enter a valid amount');
                return;
            }
            
            // Disable button to prevent multiple clicks
            newButton.disabled = true;
            newButton.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Sending...
            `;
            
            const result = await sendMoney(userId, amount, username);
            
            if (result.success) {
                // Hide modal
                const modalInstance = bootstrap.Modal.getInstance(sendMoneyModal);
                modalInstance.hide();
            }
            
            // Re-enable button
            newButton.disabled = false;
            newButton.textContent = 'Send';
        });
    }
    
    // Show modal
    const modal = new bootstrap.Modal(sendMoneyModal);
    modal.show();
}
