/**
 * Newsfeed functionality for ArcadeTalk
 */

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) return;
    
    // Initialize Newsfeed
    setupNewsfeed();
    
    // Setup mobile navigation
    setupMobileNav();
    
    // Setup notifications modal
    setupNotifications();
    
    // Update notification badge
    updateNotificationBadge();
    
    // Update user UI with current data
    const user = getCurrentUser();
    if (user) {
        updateUserUI(user);
    }
});

// Setup the newsfeed page
function setupNewsfeed() {
    // Get DOM elements
    const postContent = document.getElementById('postContent');
    const createPostBtn = document.getElementById('createPostBtn');
    const postsContainer = document.getElementById('postsContainer');
    
    // Load posts
    loadPosts();
    
    // Setup create post functionality
    if (createPostBtn && postContent) {
        createPostBtn.addEventListener('click', () => {
            const content = postContent.value.trim();
            
            if (content) {
                createPost(content);
            } else {
                showToast('Error', 'Post content cannot be empty');
            }
        });
    }
}

// Load posts from the server
async function loadPosts() {
    const postsContainer = document.getElementById('postsContainer');
    
    if (!postsContainer) return;
    
    try {
        postsContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
        
        const data = await fetchWithAuth('/api/posts');
        
        postsContainer.innerHTML = '';
        
        if (data.posts && data.posts.length > 0) {
            data.posts.forEach(post => {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);
            });
        } else {
            postsContainer.innerHTML = `
                <div class="text-center p-5">
                    <i class="fas fa-newspaper fa-4x text-muted mb-3"></i>
                    <p>No posts yet. Be the first to post!</p>
                </div>
            `;
        }
    } catch (error) {
        postsContainer.innerHTML = `
            <div class="text-center p-5">
                <i class="fas fa-exclamation-triangle fa-4x text-danger mb-3"></i>
                <p>Error loading posts. Please try again later.</p>
            </div>
        `;
        handleApiError(error, 'Failed to load posts');
    }
}

// Create a new post
async function createPost(content) {
    const postContent = document.getElementById('postContent');
    const createPostBtn = document.getElementById('createPostBtn');
    
    try {
        // Disable button to prevent multiple submissions
        if (createPostBtn) {
            createPostBtn.disabled = true;
            createPostBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Posting...
            `;
        }
        
        const data = await fetchWithAuth('/api/posts', {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        
        // Clear input
        if (postContent) {
            postContent.value = '';
        }
        
        // Show success message
        showToast('Success', 'Post created successfully');
        
        // Add new post to the top of the feed
        if (data.post) {
            const postsContainer = document.getElementById('postsContainer');
            
            if (postsContainer) {
                const postElement = createPostElement(data.post);
                
                if (postsContainer.firstChild) {
                    postsContainer.insertBefore(postElement, postsContainer.firstChild);
                } else {
                    postsContainer.appendChild(postElement);
                }
            }
            
            // Notify via socket about new post
            if (socket) {
                socket.emit('new_post_created', {
                    postId: data.post.id
                });
            }
        }
    } catch (error) {
        handleApiError(error, 'Failed to create post');
    } finally {
        // Re-enable button
        if (createPostBtn) {
            createPostBtn.disabled = false;
            createPostBtn.textContent = 'Post';
        }
    }
}

// Create post element for the DOM
function createPostElement(post) {
    // Create date string
    const date = new Date(post.createdAt);
    const dateString = formatDate(post.createdAt);
    
    // Get current user to check if this is the user's post
    const currentUser = getCurrentUser();
    const isUserPost = currentUser && post.userId === currentUser.id;
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    // Create post element
    const postCard = createElement('div', { className: 'card post-card fade-in' }, [
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
        
        // Post actions
        createElement('div', { className: 'post-actions' }, [
            // Like/react button
            createElement('button', { 
                className: `post-action-btn ${post.userReaction ? 'active' : ''}`,
                id: `reactBtn-${post.id}`,
                onclick: () => toggleReactionMenu(post.id)
            }, [
                createElement('i', { 
                    className: getReactionIcon(post.userReaction)
                }),
                createElement('span', {}, getReactionCount(post.reactions))
            ]),
            
            // Comment button
            createElement('button', { 
                className: 'post-action-btn',
                onclick: () => showComments(post.id)
            }, [
                createElement('i', { className: 'fas fa-comment' }),
                createElement('span', {}, post.commentsCount)
            ]),
            
            // Delete button (shown only for user's own posts or admin)
            (isUserPost || isAdmin) ? 
                createElement('button', { 
                    className: 'post-action-btn text-danger ms-auto',
                    onclick: () => deletePost(post.id)
                }, [
                    createElement('i', { className: 'fas fa-trash' })
                ]) : null
        ]),
        
        // Hidden reaction menu (will be shown on click)
        createElement('div', { 
            className: 'reaction-buttons',
            id: `reactionMenu-${post.id}`,
            style: { display: 'none' }
        }, [
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'like')
            }, '👍'),
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'love')
            }, '❤️'),
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'laugh')
            }, '😂'),
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'wow')
            }, '😮'),
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'sad')
            }, '😢'),
            createElement('button', { 
                className: 'reaction-btn',
                onclick: () => reactToPost(post.id, 'angry')
            }, '😡'),
            createElement('button', { 
                className: 'reaction-btn text-danger',
                onclick: () => removeReaction(post.id)
            }, '✖')
        ])
    ]);
    
    return postCard;
}

// Get the total count of reactions
function getReactionCount(reactions) {
    if (!reactions) return 0;
    
    return Object.values(reactions).reduce((sum, count) => sum + count, 0);
}

// Get the appropriate icon for a reaction
function getReactionIcon(reaction) {
    if (!reaction) return 'far fa-thumbs-up';
    
    switch (reaction) {
        case 'like': return 'fas fa-thumbs-up';
        case 'love': return 'fas fa-heart';
        case 'laugh': return 'fas fa-laugh';
        case 'wow': return 'fas fa-surprise';
        case 'sad': return 'fas fa-sad-tear';
        case 'angry': return 'fas fa-angry';
        default: return 'far fa-thumbs-up';
    }
}

// Toggle reaction menu visibility
function toggleReactionMenu(postId) {
    const menu = document.getElementById(`reactionMenu-${postId}`);
    
    // Hide all other reaction menus
    document.querySelectorAll('.reaction-buttons').forEach(el => {
        if (el.id !== `reactionMenu-${postId}`) {
            el.style.display = 'none';
        }
    });
    
    // Toggle this menu
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    }
    
    // Add click outside listener
    if (menu.style.display === 'flex') {
        setTimeout(() => {
            document.addEventListener('click', function hideMenu(e) {
                if (!menu.contains(e.target) && e.target.id !== `reactBtn-${postId}`) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', hideMenu);
                }
            });
        }, 0);
    }
}

// React to a post
async function reactToPost(postId, reaction) {
    try {
        const data = await fetchWithAuth(`/api/posts/${postId}/react`, {
            method: 'POST',
            body: JSON.stringify({ reaction })
        });
        
        // Update UI
        if (data.post) {
            // Update reaction button
            const reactBtn = document.getElementById(`reactBtn-${postId}`);
            if (reactBtn) {
                reactBtn.classList.add('active');
                
                // Update icon
                const icon = reactBtn.querySelector('i');
                if (icon) {
                    icon.className = getReactionIcon(reaction);
                }
                
                // Update count
                const countSpan = reactBtn.querySelector('span');
                if (countSpan) {
                    countSpan.textContent = getReactionCount(data.post.reactions);
                }
            }
            
            // Hide reaction menu
            const menu = document.getElementById(`reactionMenu-${postId}`);
            if (menu) {
                menu.style.display = 'none';
            }
            
            // Notify via socket about new reaction
            if (socket) {
                socket.emit('new_post_reaction', {
                    postId,
                    reaction
                });
            }
        }
    } catch (error) {
        handleApiError(error, 'Failed to react to post');
    }
}

// Remove reaction from a post
async function removeReaction(postId) {
    try {
        const data = await fetchWithAuth(`/api/posts/${postId}/react`, {
            method: 'DELETE'
        });
        
        // Update UI
        if (data.post) {
            // Update reaction button
            const reactBtn = document.getElementById(`reactBtn-${postId}`);
            if (reactBtn) {
                reactBtn.classList.remove('active');
                
                // Update icon
                const icon = reactBtn.querySelector('i');
                if (icon) {
                    icon.className = 'far fa-thumbs-up';
                }
                
                // Update count
                const countSpan = reactBtn.querySelector('span');
                if (countSpan) {
                    countSpan.textContent = getReactionCount(data.post.reactions);
                }
            }
            
            // Hide reaction menu
            const menu = document.getElementById(`reactionMenu-${postId}`);
            if (menu) {
                menu.style.display = 'none';
            }
        }
    } catch (error) {
        handleApiError(error, 'Failed to remove reaction');
    }
}

// Delete a post
async function deletePost(postId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this post?')) {
        return;
    }
    
    try {
        await fetchWithAuth(`/api/posts/${postId}`, {
            method: 'DELETE'
        });
        
        // Remove post from UI
        const postCard = document.getElementById(`reactBtn-${postId}`).closest('.post-card');
        if (postCard) {
            postCard.remove();
        }
        
        showToast('Success', 'Post deleted successfully');
    } catch (error) {
        handleApiError(error, 'Failed to delete post');
    }
}

// Show comments for a post
async function showComments(postId) {
    // Get modal elements
    const commentModal = document.getElementById('commentModal');
    const commentsContainer = document.getElementById('commentsContainer');
    const commentInput = document.getElementById('commentInput');
    const addCommentBtn = document.getElementById('addCommentBtn');
    
    if (!commentModal || !commentsContainer) return;
    
    // Show modal
    const modal = new bootstrap.Modal(commentModal);
    modal.show();
    
    // Clear previous comments
    commentsContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    try {
        // Load comments
        const data = await fetchWithAuth(`/api/posts/${postId}/comments`);
        
        // Store postId for adding comments
        commentModal.dataset.postId = postId;
        
        // Display comments
        commentsContainer.innerHTML = '';
        
        if (data.comments && data.comments.length > 0) {
            data.comments.forEach(comment => {
                const commentElement = createCommentElement(comment);
                commentsContainer.appendChild(commentElement);
            });
        } else {
            commentsContainer.innerHTML = `
                <div class="text-center p-3">
                    <p>No comments yet. Be the first to comment!</p>
                </div>
            `;
        }
        
        // Setup add comment button
        if (addCommentBtn) {
            // Remove previous event listeners
            const newAddCommentBtn = addCommentBtn.cloneNode(true);
            addCommentBtn.parentNode.replaceChild(newAddCommentBtn, addCommentBtn);
            
            // Add new event listener
            newAddCommentBtn.addEventListener('click', () => {
                const content = commentInput.value.trim();
                
                if (content) {
                    addComment(postId, content);
                } else {
                    showToast('Error', 'Comment cannot be empty');
                }
            });
        }
    } catch (error) {
        commentsContainer.innerHTML = `
            <div class="text-center p-3">
                <p>Error loading comments. Please try again later.</p>
            </div>
        `;
        handleApiError(error, 'Failed to load comments');
    }
}

// Create comment element for the DOM
function createCommentElement(comment) {
    // Create date string
    const dateString = formatDate(comment.createdAt);
    
    // Get current user to check if this is the user's comment
    const currentUser = getCurrentUser();
    const isUserComment = currentUser && comment.userId === currentUser.id;
    const isAdmin = currentUser && currentUser.role === 'admin';
    
    // Create comment element
    const commentElement = createElement('div', { className: 'card mb-2 fade-in' }, [
        createElement('div', { className: 'card-body' }, [
            createElement('div', { className: 'd-flex' }, [
                createElement('img', { 
                    src: comment.user.avatar, 
                    alt: comment.user.username, 
                    className: 'profile-pic me-2',
                    style: { width: '30px', height: '30px' }
                }),
                createElement('div', { className: 'flex-grow-1' }, [
                    createElement('div', { className: 'd-flex justify-content-between align-items-center' }, [
                        createElement('h6', { className: 'mb-0' }, comment.user.username),
                        createElement('small', { className: 'text-muted' }, dateString)
                    ]),
                    createElement('p', { className: 'mb-0 mt-1' }, escapeHtml(comment.content))
                ]),
                // Delete button (shown only for user's own comments, post owner, or admin)
                (isUserComment || isAdmin) ? 
                    createElement('button', { 
                        className: 'btn btn-sm text-danger ms-2',
                        onclick: () => deleteComment(comment.postId, comment.id)
                    }, [
                        createElement('i', { className: 'fas fa-trash' })
                    ]) : null
            ])
        ])
    ]);
    
    return commentElement;
}

// Add a comment to a post
async function addComment(postId, content) {
    const commentInput = document.getElementById('commentInput');
    const addCommentBtn = document.getElementById('addCommentBtn');
    const commentsContainer = document.getElementById('commentsContainer');
    
    try {
        // Disable button to prevent multiple submissions
        if (addCommentBtn) {
            addCommentBtn.disabled = true;
            addCommentBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Commenting...
            `;
        }
        
        const data = await fetchWithAuth(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        
        // Clear input
        if (commentInput) {
            commentInput.value = '';
        }
        
        // Add new comment to the container
        if (data.comment && commentsContainer) {
            // Remove "no comments" message if present
            if (commentsContainer.querySelector('.text-center')) {
                commentsContainer.innerHTML = '';
            }
            
            const commentElement = createCommentElement(data.comment);
            commentsContainer.appendChild(commentElement);
            
            // Update comment count on the post
            const postCommentCount = document.querySelector(`#reactBtn-${postId}`).parentNode.querySelector('.fa-comment').nextElementSibling;
            if (postCommentCount) {
                postCommentCount.textContent = parseInt(postCommentCount.textContent) + 1;
            }
            
            // Notify via socket about new comment
            if (socket) {
                socket.emit('new_comment_added', {
                    postId,
                    commentId: data.comment.id
                });
            }
        }
    } catch (error) {
        handleApiError(error, 'Failed to add comment');
    } finally {
        // Re-enable button
        if (addCommentBtn) {
            addCommentBtn.disabled = false;
            addCommentBtn.textContent = 'Comment';
        }
    }
}

// Delete a comment
async function deleteComment(postId, commentId) {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this comment?')) {
        return;
    }
    
    try {
        await fetchWithAuth(`/api/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE'
        });
        
        // Find the comment element and remove it
        const commentElements = document.querySelectorAll('.card');
        for (const element of commentElements) {
            if (element.querySelector('p')?.textContent === commentId) {
                element.remove();
                break;
            }
        }
        
        // Update comment count on the post
        const postCommentCount = document.querySelector(`#reactBtn-${postId}`).parentNode.querySelector('.fa-comment').nextElementSibling;
        if (postCommentCount) {
            const currentCount = parseInt(postCommentCount.textContent);
            if (currentCount > 0) {
                postCommentCount.textContent = currentCount - 1;
            }
        }
        
        showToast('Success', 'Comment deleted successfully');
    } catch (error) {
        handleApiError(error, 'Failed to delete comment');
    }
}

// Setup notifications modal
function setupNotifications() {
    const notificationsBtn = document.getElementById('notificationsBtn');
    const mobileNotificationsBtn = document.getElementById('mobileNotificationsBtn');
    const notificationsModal = document.getElementById('notificationsModal');
    const notificationsContainer = document.getElementById('notificationsContainer');
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    const emptyNotifications = document.getElementById('emptyNotifications');
    
    // Function to handle notification button clicks (desktop and mobile)
    const handleNotificationsClick = (e) => {
        if (e) {
            e.preventDefault();
        }
        
        // Show modal
        const modal = new bootstrap.Modal(notificationsModal);
        modal.show();
        
        // Load notifications
        if (notificationsContainer) {
            notificationsContainer.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
            
            // Get notifications via socket
            if (socket) {
                socket.emit('get_notifications', {}, (response) => {
                    if (response.success && response.notifications) {
                        notificationsContainer.innerHTML = '';
                        
                        if (response.notifications.length > 0) {
                            if (emptyNotifications) {
                                emptyNotifications.style.display = 'none';
                            }
                            
                            response.notifications.forEach(notification => {
                                const notificationElement = createNotificationElement(notification);
                                notificationsContainer.appendChild(notificationElement);
                            });
                        } else {
                            if (emptyNotifications) {
                                emptyNotifications.style.display = 'block';
                            }
                        }
                    } else {
                        notificationsContainer.innerHTML = `
                            <div class="text-center p-3">
                                <p>Error loading notifications. Please try again later.</p>
                            </div>
                        `;
                    }
                });
            }
        }
    };
    
    // Make handleNotificationsClick available globally
    window.handleNotificationsClick = handleNotificationsClick;
    
    // Add click handlers to notification buttons
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', handleNotificationsClick);
    }
    
    if (mobileNotificationsBtn) {
        mobileNotificationsBtn.addEventListener('click', handleNotificationsClick);
    }
    
    // Handle mark all as read button
    if (markAllReadBtn && socket) {
        markAllReadBtn.addEventListener('click', () => {
            socket.emit('mark_all_notifications_read', {}, (response) => {
                if (response.success) {
                    // Update UI
                    const unreadNotifications = notificationsContainer.querySelectorAll('.notification-item.unread');
                    unreadNotifications.forEach(item => {
                        item.classList.remove('unread');
                    });
                    
                    // Update badges with the unified function
                    updateNotificationBadge();
                    
                    showToast('Success', 'All notifications marked as read');
                }
            });
        });
    }
}

// Create notification element for the DOM
function createNotificationElement(notification) {
    // Create date string
    const dateString = formatDate(notification.createdAt);
    
    // Create notification element
    const notificationElement = createElement('div', { 
        className: `notification-item ${notification.isRead ? '' : 'unread'}`,
        'data-id': notification.id,
        onclick: () => markNotificationRead(notification.id)
    }, [
        createElement('div', { className: 'd-flex justify-content-between' }, [
            createElement('p', { className: 'mb-0' }, escapeHtml(notification.content)),
            createElement('small', { className: 'time' }, dateString)
        ])
    ]);
    
    return notificationElement;
}

// Mark notification as read
function markNotificationRead(notificationId) {
    if (!socket) return;
    
    socket.emit('mark_notification_read', { notificationId }, (response) => {
        if (response.success) {
            // Update UI
            const notificationElement = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
            if (notificationElement) {
                notificationElement.classList.remove('unread');
            }
            
            // Update badge
            updateNotificationBadge();
        }
    });
}
