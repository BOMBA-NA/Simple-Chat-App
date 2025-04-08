/**
 * Chat functionality for ArcadeTalk
 */

let activeChat = null;
let typingTimeout = null;
let lastTypingTime = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize Chat
    setupChat();
    
    // Initialize Send Money Modal
    setupSendMoneyModal();
    
    // Listen for Socket.io events
    if (socket) {
        setupChatSocketListeners();
    }
});

// Setup chat functionality
function setupChat() {
    // Get necessary DOM elements
    const chatTab = document.getElementById('chatTab');
    const chatList = document.getElementById('chatList');
    const messageInput = document.getElementById('messageInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const chatUserAvatar = document.getElementById('chatUserAvatar');
    const chatUsername = document.getElementById('chatUsername');
    const messagesContainer = document.getElementById('messagesContainer');
    const emptyChatPlaceholder = document.getElementById('emptyChatPlaceholder');
    const chatInterface = document.getElementById('chatInterface');
    
    // Load recent chats when the chat tab is clicked
    if (chatTab) {
        chatTab.addEventListener('click', (e) => {
            e.preventDefault();
            loadRecentChats();
            // Refresh chat layout after a small delay to ensure DOM is ready
            setTimeout(() => refreshChatLayout(), 100);
        });
    }
    
    // Also load chats when clicking the mobile nav chat icon
    const chatNavItem = document.querySelector('.mobile-nav-item[data-section="chatSection"]');
    if (chatNavItem) {
        chatNavItem.addEventListener('click', () => {
            loadRecentChats();
            // Refresh chat layout after a small delay to ensure DOM is ready
            setTimeout(() => refreshChatLayout(), 100);
        });
    }
    
    // Handle send message button click
    if (sendMessageBtn && messageInput) {
        sendMessageBtn.addEventListener('click', () => {
            sendMessage();
        });
        
        // Also send message on Enter key (but Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Handle typing indicator
        messageInput.addEventListener('input', () => {
            if (!activeChat) return;
            
            // Check if we should send a typing notification
            const currentTime = new Date().getTime();
            const timeDiff = currentTime - lastTypingTime;
            
            // Only send typing event if more than 3 seconds have passed since last one
            if (timeDiff > 3000) {
                lastTypingTime = currentTime;
                socket.emit('typing', { receiverId: activeChat.userId });
            }
            
            // Clear previous timeout
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            
            // Set timeout to emit stop typing
            typingTimeout = setTimeout(() => {
                socket.emit('stop_typing', { receiverId: activeChat.userId });
            }, 3000);
        });
    }
}

// Setup chat socket listeners
function setupChatSocketListeners() {
    // Listen for incoming messages
    socket.on('receive_message', (message) => {
        // Add message to UI if it's from the active chat
        if (activeChat && message.senderId === activeChat.userId) {
            appendMessage(message, false);
            
            // Scroll to bottom
            scrollToBottom();
        }
        
        // Update recent chats list
        loadRecentChats();
    });
    
    // Listen for message sent confirmation
    socket.on('message_sent', (message) => {
        // Add message to UI
        if (activeChat && message.receiverId === activeChat.userId) {
            appendMessage(message, true);
            
            // Scroll to bottom
            scrollToBottom();
        }
    });
    
    // Listen for typing indicator
    socket.on('user_typing', (data) => {
        if (activeChat && data.userId === activeChat.userId) {
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.textContent = `${data.username} is typing...`;
                typingIndicator.style.display = 'block';
            }
        }
    });
    
    // Listen for stop typing
    socket.on('user_stopped_typing', (data) => {
        if (activeChat && data.userId === activeChat.userId) {
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
        }
    });
    
    // Listen for message reactions
    socket.on('message_reaction', (data) => {
        updateMessageReaction(data.messageId, data.userId, data.emoji);
    });
    
    // Listen for reaction removal
    socket.on('message_reaction_removed', (data) => {
        removeMessageReaction(data.messageId, data.userId);
    });
    
    // Listen for message unsent
    socket.on('message_unsent', (data) => {
        markMessageAsUnsent(data.messageId);
    });
    
    // Listen for user status changes
    socket.on('user_status_change', (data) => {
        // Update status indicators in chat list
        updateUserStatus(data.userId, data.status);
        
        // Update the active chat header if this is the active user
        if (activeChat && data.userId === activeChat.userId) {
            const statusIndicator = document.querySelector('.status-indicator-text');
            if (statusIndicator) {
                statusIndicator.className = `status-indicator-text ms-2 ${data.status === 'online' ? 'text-success' : 'text-muted'}`;
                statusIndicator.textContent = data.status;
            }
            
            // If status changed to online, refresh chat to ensure we have latest data
            if (data.status === 'online') {
                loadChatHistory(activeChat.userId);
            }
        }
        
        // Show playful toast notification for users coming online (but not when going offline)
        if (data.status === 'online') {
            const randomEmojis = ['🎮', '🕹️', '🎯', '🎲', '🎪', '🎭', '🎨', '🎡'];
            const randomEmoji = randomEmojis[Math.floor(Math.random() * randomEmojis.length)];
            showToast('User Online', `${randomEmoji} ${data.username} is now online!`, 2000);
        }
    });
}

// Update user status in the chat list
function updateUserStatus(userId, status) {
    // Find all chat items for this user
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        // Look for the username in this item
        const usernameEl = item.querySelector('h6');
        const chatUserId = item.getAttribute('data-user-id');
        
        // Check if this item belongs to the user (need to add data-user-id attribute elsewhere)
        if (chatUserId === userId || item.onclick?.toString().includes(userId)) {
            // Find status indicator
            const statusIndicator = item.querySelector('.status-indicator');
            if (statusIndicator) {
                // Update class
                statusIndicator.className = `status-indicator ${status === 'online' ? 'status-online' : 'status-offline'}`;
                
                // Add animation for transitions
                statusIndicator.classList.add('status-animation');
                
                // Remove animation class after animation completes
                setTimeout(() => {
                    statusIndicator.classList.remove('status-animation');
                }, 1000);
            }
        }
    });
}

// Load recent chats and available users
function loadRecentChats() {
    const chatList = document.getElementById('chatList');
    const chatContainer = document.getElementById('chatContainer');
    
    if (!chatList) return;
    
    // Show loading spinner
    chatList.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    // Get recent chats via socket
    if (socket) {
        socket.emit('get_recent_chats', {}, (response) => {
            if (response.success) {
                chatList.innerHTML = '';
                
                // Add "Available Users" section header
                const allUsersHeader = createElement('div', {
                    className: 'chat-section-header'
                }, [
                    createElement('h6', { className: 'mb-2 chat-section-title' }, 'All Users')
                ]);
                
                chatList.appendChild(allUsersHeader);
                
                // Create "Available Users" section with all users
                if (response.availableUsers && response.availableUsers.length > 0) {
                    // Sort users - online first, then alphabetically
                    const sortedUsers = response.availableUsers.sort((a, b) => {
                        // First sort by online status
                        if (a.isOnline && !b.isOnline) return -1;
                        if (!a.isOnline && b.isOnline) return 1;
                        
                        // Then sort by username
                        return a.username.localeCompare(b.username);
                    });
                    
                    sortedUsers.forEach(user => {
                        const userChat = {
                            userId: user.id,
                            username: user.displayName || user.username,
                            avatar: user.avatar,
                            isOnline: user.isOnline,
                            status: user.status || 'offline',
                            isAdmin: user.isAdmin,
                            adminBadge: user.adminBadge
                        };
                        
                        const chatElement = createChatElement(userChat);
                        chatList.appendChild(chatElement);
                    });
                }
                
                // Add "Recent Chats" section if there are any
                if (response.chats && response.chats.length > 0) {
                    const recentChatsHeader = createElement('div', {
                        className: 'chat-section-header mt-3'
                    }, [
                        createElement('h6', { className: 'mb-2 chat-section-title' }, 'Recent Chats')
                    ]);
                    
                    chatList.appendChild(recentChatsHeader);
                    
                    response.chats.forEach(chat => {
                        const chatElement = createChatElement(chat);
                        chatList.appendChild(chatElement);
                    });
                }
                
                // Show empty state message if no users available
                if ((!response.availableUsers || response.availableUsers.length === 0) && 
                    (!response.chats || response.chats.length === 0)) {
                    chatList.innerHTML = `
                        <div class="text-center p-3">
                            <p>No users available to chat with.</p>
                        </div>
                    `;
                }
            } else {
                chatList.innerHTML = `
                    <div class="text-center p-3">
                        <p>Error loading users and chats. Please try again later.</p>
                    </div>
                `;
            }
        });
    } else {
        chatList.innerHTML = `
            <div class="text-center p-3">
                <p>Connection error. Please refresh the page.</p>
            </div>
        `;
    }
}

// Create chat element for the chat list
function createChatElement(chat) {
    // Get last message preview
    let messagePreview = 'Start a conversation';
    
    if (chat.lastMessage) {
        if (chat.lastMessage.isDeleted) {
            messagePreview = 'This message was deleted';
        } else {
            messagePreview = truncateText(chat.lastMessage.content, 30);
        }
    }
    
    // Create time string if available
    let timeString = '';
    if (chat.timestamp) {
        timeString = formatDate(chat.timestamp);
    }
    
    // Create status indicator element based on online status
    const statusIndicator = createElement('span', {
        className: `status-indicator ${chat.isOnline ? 'status-online' : 'status-offline'}`
    });
    
    // Create avatar container with status indicator
    const avatarContainer = createElement('div', {
        className: 'avatar-container position-relative'
    }, [
        createElement('img', { 
            src: chat.avatar || 'https://ui-avatars.com/api/?name=Unknown&background=random', 
            alt: chat.username, 
            className: 'chat-avatar'
        }),
        statusIndicator
    ]);
    
    // Prepare username element, include admin badge if needed
    let usernameElement;
    if (chat.isAdmin || chat.adminBadge) {
        usernameElement = createElement('div', { 
            className: 'd-flex align-items-center' 
        }, [
            createElement('h6', { className: 'mb-0 me-1' }, chat.username),
            createElement('span', { 
                className: 'admin-badge',
                title: 'Administrator'
            }, 'admin')
        ]);
    } else {
        usernameElement = createElement('h6', { className: 'mb-0' }, chat.username);
    }
    
    // Create chat list item
    const chatItem = createElement('div', { 
        className: `list-group-item chat-item ${activeChat && activeChat.userId === chat.userId ? 'active' : ''}`,
        onclick: () => openChat(chat)
    }, [
        avatarContainer,
        createElement('div', { className: 'flex-grow-1 ms-3' }, [
            createElement('div', { className: 'd-flex justify-content-between' }, [
                usernameElement,
                createElement('small', { className: 'text-muted' }, timeString)
            ]),
            createElement('p', { className: 'mb-0 text-muted small' }, escapeHtml(messagePreview))
        ])
    ]);
    
    return chatItem;
}

// Open a chat
function openChat(chat) {
    // Set active chat
    activeChat = chat;
    
    // Update UI
    const chatUserAvatar = document.getElementById('chatUserAvatar');
    const chatUsername = document.getElementById('chatUsername');
    const messagesContainer = document.getElementById('messagesContainer');
    const emptyChatPlaceholder = document.getElementById('emptyChatPlaceholder');
    const chatInterface = document.getElementById('chatInterface');
    const typingIndicator = document.getElementById('typingIndicator');
    
    // Refresh layout for proper sizing, especially on mobile
    setTimeout(() => refreshChatLayout(), 100); // Small delay to ensure DOM is updated
    
    // Update chat header
    if (chatUserAvatar && chatUsername) {
        chatUserAvatar.src = chat.avatar || 'https://ui-avatars.com/api/?name=Unknown&background=random';
        
        // Clear previous content
        chatUsername.innerHTML = '';
        
        // Add username with admin badge if admin
        if (chat.isAdmin || chat.adminBadge) {
            const usernameSpan = document.createElement('span');
            usernameSpan.textContent = chat.username;
            chatUsername.appendChild(usernameSpan);
            
            const adminBadge = document.createElement('span');
            adminBadge.className = 'admin-badge ms-2';
            adminBadge.title = 'Administrator';
            adminBadge.textContent = 'admin';
            chatUsername.appendChild(adminBadge);
        } else {
            chatUsername.textContent = chat.username;
        }
        
        // Add online status indicator
        const statusIndicator = document.createElement('span');
        statusIndicator.className = `status-indicator-text ms-2 ${chat.isOnline ? 'text-success' : 'text-muted'}`;
        statusIndicator.textContent = chat.isOnline ? 'online' : 'offline';
        chatUsername.appendChild(statusIndicator);
    }
    
    // Hide typing indicator
    if (typingIndicator) {
        typingIndicator.style.display = 'none';
    }
    
    // Show chat interface, hide placeholder
    if (emptyChatPlaceholder && chatInterface) {
        emptyChatPlaceholder.style.display = 'none';
        chatInterface.style.display = 'flex';
    }
    
    // Clear messages container
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
    
    // Update active state in chat list
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Find the clicked item and add active class
    const clickedItem = Array.from(chatItems).find(
        item => item.querySelector('h6').textContent === chat.username
    );
    
    if (clickedItem) {
        clickedItem.classList.add('active');
    }
    
    // Load chat history
    loadChatHistory(chat.userId);
}

// Load chat history
function loadChatHistory(userId) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (!messagesContainer || !socket) return;
    
    // Get chat history via socket
    socket.emit('get_chat_history', { userId }, (response) => {
        if (response.success) {
            messagesContainer.innerHTML = '';
            
            if (response.messages && response.messages.length > 0) {
                response.messages.forEach(message => {
                    // Check if this is a sent message (from current user)
                    const isSent = message.senderId === getCurrentUser().id;
                    appendMessage(message, isSent);
                });
                
                // Scroll to bottom
                scrollToBottom();
            } else {
                messagesContainer.innerHTML = `
                    <div class="text-center p-5">
                        <i class="fas fa-comments fa-4x text-muted mb-3"></i>
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                `;
            }
        } else {
            messagesContainer.innerHTML = `
                <div class="text-center p-3">
                    <p>Error loading messages. Please try again later.</p>
                </div>
            `;
        }
    });
}

// Send a message
function sendMessage() {
    if (!activeChat || !socket) return;
    
    const messageInput = document.getElementById('messageInput');
    
    if (!messageInput) return;
    
    const content = messageInput.value.trim();
    
    if (!content) {
        return;
    }
    
    // Send message via socket
    socket.emit('send_message', {
        receiverId: activeChat.userId,
        content
    }, (response) => {
        if (response.success) {
            // Clear input
            messageInput.value = '';
            
            // Reset typing indicator
            if (typingTimeout) {
                clearTimeout(typingTimeout);
            }
            socket.emit('stop_typing', { receiverId: activeChat.userId });
        } else {
            showToast('Error', response.message || 'Failed to send message');
        }
    });
}

// Append a message to the messages container
function appendMessage(message, isSent) {
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (!messagesContainer) return;
    
    // Format timestamp
    const timeString = formatTime(message.createdAt);
    
    // Create message element with appropriate classes
    const messageElement = createElement('div', { 
        className: `message ${isSent ? 'message-sent' : 'message-received'}`,
        'data-id': message.id
    }, [
        // Message content
        createElement('div', { 
            className: `message-content ${message.isDeleted ? 'message-deleted' : ''}` 
        }, message.isDeleted ? 'This message was deleted' : escapeHtml(message.content)),
        
        // Message timestamp
        createElement('div', { className: 'message-timestamp' }, timeString)
    ]);
    
    // Add message reactions if any
    if (message.reactions && Object.keys(message.reactions).length > 0) {
        const reactionsElement = createElement('div', { className: 'message-reactions' });
        
        for (const [userId, emoji] of Object.entries(message.reactions)) {
            reactionsElement.textContent += emoji;
        }
        
        messageElement.appendChild(reactionsElement);
    }
    
    // Add context menu for message actions (only for sent messages)
    if (isSent && !message.isDeleted) {
        messageElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showMessageActions(message.id, e.clientX, e.clientY);
        });
    }
    
    // Add double-click event for reactions (only for received messages that aren't deleted)
    if (!isSent && !message.isDeleted) {
        messageElement.addEventListener('dblclick', () => {
            showReactionPicker(message.id);
        });
    }
    
    // Append to container
    messagesContainer.appendChild(messageElement);
}

// Show message actions menu
function showMessageActions(messageId, x, y) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.message-action-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Create menu
    const menu = createElement('div', { 
        className: 'message-action-menu',
        style: {
            position: 'fixed',
            top: `${y}px`,
            left: `${x}px`
        }
    }, [
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => unsendMessage(messageId)
        }, 'Unsend Message')
    ]);
    
    // Add to body
    document.body.appendChild(menu);
    
    // Close menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Show reaction picker
function showReactionPicker(messageId) {
    // Remove any existing menu
    const existingMenu = document.querySelector('.message-action-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Find message element
    const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
    if (!messageElement) return;
    
    // Get position for the picker
    const rect = messageElement.getBoundingClientRect();
    
    // Create reaction picker
    const menu = createElement('div', { 
        className: 'message-action-menu',
        style: {
            position: 'fixed',
            top: `${rect.top - 40}px`,
            left: `${rect.left + (rect.width / 2) - 100}px`,
            display: 'flex',
            width: '200px',
            justifyContent: 'space-around'
        }
    }, [
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => reactToMessage(messageId, '👍')
        }, '👍'),
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => reactToMessage(messageId, '❤️')
        }, '❤️'),
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => reactToMessage(messageId, '😂')
        }, '😂'),
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => reactToMessage(messageId, '😮')
        }, '😮'),
        createElement('div', { 
            className: 'message-action-item',
            onclick: () => reactToMessage(messageId, '😢')
        }, '😢'),
        createElement('div', { 
            className: 'message-action-item text-danger',
            onclick: () => removeMessageReaction(messageId, getCurrentUser().id)
        }, '✖')
    ]);
    
    // Add to body
    document.body.appendChild(menu);
    
    // Close menu when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Unsend a message
function unsendMessage(messageId) {
    if (!socket) return;
    
    socket.emit('unsend_message', { messageId }, (response) => {
        if (response.success) {
            markMessageAsUnsent(messageId);
        } else {
            showToast('Error', response.message || 'Failed to unsend message');
        }
    });
}

// Mark a message as unsent in the UI
function markMessageAsUnsent(messageId) {
    const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
    
    if (messageElement) {
        const contentElement = messageElement.querySelector('.message-content');
        
        if (contentElement) {
            contentElement.textContent = 'This message was deleted';
            contentElement.classList.add('message-deleted');
        }
        
        // Remove any reactions
        const reactionsElement = messageElement.querySelector('.message-reactions');
        if (reactionsElement) {
            reactionsElement.remove();
        }
        
        // Remove event listeners by cloning and replacing
        const newElement = messageElement.cloneNode(true);
        messageElement.parentNode.replaceChild(newElement, messageElement);
    }
}

// React to a message
function reactToMessage(messageId, emoji) {
    if (!socket) return;
    
    socket.emit('react_to_message', { messageId, emoji }, (response) => {
        if (!response.success) {
            showToast('Error', response.message || 'Failed to add reaction');
        }
    });
}

// Update message reaction in the UI
function updateMessageReaction(messageId, userId, emoji) {
    const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
    
    if (!messageElement) return;
    
    // Get or create reactions element
    let reactionsElement = messageElement.querySelector('.message-reactions');
    
    if (!reactionsElement) {
        reactionsElement = createElement('div', { className: 'message-reactions' });
        messageElement.appendChild(reactionsElement);
    }
    
    // Update reactions
    // In a real app, we would maintain a map of user reactions
    // For simplicity, we'll just set the text content
    const existingEmojis = reactionsElement.textContent;
    
    // Check if already contains this emoji
    if (!existingEmojis.includes(emoji)) {
        reactionsElement.textContent += emoji;
    }
}

// Remove message reaction in the UI
function removeMessageReaction(messageId, userId) {
    const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
    
    if (!messageElement) return;
    
    // Get reactions element
    const reactionsElement = messageElement.querySelector('.message-reactions');
    
    if (!reactionsElement) return;
    
    // In a real app, we would remove the specific user's reaction
    // For simplicity, we'll just remove the element if it only has one reaction
    // or leave it otherwise
    if (reactionsElement.textContent.length <= 2) {
        reactionsElement.remove();
    }
    
    // In a real app with Socket.io, the server would send an updated list of reactions
}

// Scroll to the bottom of the messages container
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Refresh chat layout when switching to chat section or on resize
function refreshChatLayout() {
    // Adjust container heights for mobile views
    const isMobile = window.innerWidth <= 768;
    const chatContainer = document.getElementById('chatContainer');
    const messagesContainer = document.getElementById('messagesContainer');
    const chatHeader = document.querySelector('.chat-header');
    const chatInputContainer = document.querySelector('.chat-input-container');
    const chatList = document.getElementById('chatList');
    
    if (!chatContainer) return;
    
    if (isMobile) {
        // For mobile: adjust heights accordingly
        if (messagesContainer && chatHeader && chatInputContainer) {
            const containerHeight = chatContainer.clientHeight;
            const headerHeight = chatHeader.clientHeight || 56; // Default height if not yet rendered
            const inputHeight = chatInputContainer.clientHeight || 70; // Default height if not yet rendered
            const availableHeight = containerHeight - headerHeight - inputHeight;
            
            if (availableHeight > 100) { // Sanity check
                messagesContainer.style.height = `${availableHeight}px`;
            }
        }
        
        // Ensure the chat list takes appropriate height
        if (chatList) {
            chatList.style.maxHeight = '160px';
        }
    } else {
        // For desktop: reset to CSS defaults
        if (messagesContainer) {
            messagesContainer.style.height = '';
        }
        if (chatList) {
            chatList.style.maxHeight = '';
        }
    }
    
    // Always scroll to bottom after layout refresh if we have an active chat
    if (activeChat) {
        scrollToBottom();
    }
    
    console.log('Chat layout refreshed');
}

// Add window resize listener to adapt chat layout
window.addEventListener('resize', () => {
    if (document.getElementById('chatSection') && 
        document.getElementById('chatSection').classList.contains('active')) {
        refreshChatLayout();
    }
});

// Setup Send Money Modal
function setupSendMoneyModal() {
    const sendMoneyBtn = document.getElementById('sendMoneyBtn');
    const sendMoneyModal = document.getElementById('sendMoneyModal');
    const recipientName = document.getElementById('recipientName');
    const transferAmount = document.getElementById('transferAmount');
    const senderBalance = document.getElementById('senderBalance');
    const confirmSendMoneyBtn = document.getElementById('confirmSendMoneyBtn');
    
    if (sendMoneyBtn && sendMoneyModal) {
        sendMoneyBtn.addEventListener('click', () => {
            if (!activeChat) return;
            
            // Set recipient name
            if (recipientName) {
                recipientName.textContent = activeChat.username;
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
            
            // Show modal
            const modal = new bootstrap.Modal(sendMoneyModal);
            modal.show();
        });
    }
    
    // Handle send money confirmation
    if (confirmSendMoneyBtn) {
        confirmSendMoneyBtn.addEventListener('click', async () => {
            if (!activeChat || !transferAmount) return;
            
            const amount = parseInt(transferAmount.value);
            
            if (isNaN(amount) || amount <= 0) {
                showToast('Error', 'Please enter a valid amount');
                return;
            }
            
            try {
                // Disable button to prevent multiple clicks
                confirmSendMoneyBtn.disabled = true;
                confirmSendMoneyBtn.innerHTML = `
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Sending...
                `;
                
                // Send money request
                const data = await fetchWithAuth('/api/users/transfer', {
                    method: 'POST',
                    body: JSON.stringify({
                        receiverId: activeChat.userId,
                        amount
                    })
                });
                
                // Hide modal
                const modalInstance = bootstrap.Modal.getInstance(sendMoneyModal);
                modalInstance.hide();
                
                // Show success message
                showToast('Success', data.message);
                
                // Update UI with new balance
                const currentUser = getCurrentUser();
                currentUser.balance = data.balance;
                localStorage.setItem('user', JSON.stringify(currentUser));
                
                // Update UI
                updateUserUI(currentUser);
                
                // Notify recipient via socket
                if (socket) {
                    socket.emit('balance_updated', { receiverId: activeChat.userId });
                }
            } catch (error) {
                handleApiError(error, 'Failed to send money');
            } finally {
                // Re-enable button
                confirmSendMoneyBtn.disabled = false;
                confirmSendMoneyBtn.textContent = 'Send';
            }
        });
    }
}

// Function to display the send money modal
function showSendMoneyModal(userId, username) {
    const modal = document.getElementById('sendMoneyModal');
    if (!modal) return;
    
    // Set receiver info
    document.getElementById('recipientName').textContent = username;
    
    // Store user ID for later use
    modal.setAttribute('data-receiver-id', userId);
    
    // Set current balance
    const currentUser = getCurrentUser();
    if (currentUser) {
        document.getElementById('senderBalance').textContent = currentUser.balance;
    }
    
    // Reset amount field
    document.getElementById('transferAmount').value = '';
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}
