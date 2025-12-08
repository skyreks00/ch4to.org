// Variables globales
let appCurrentUser = null;
let currentConversation = null;
let currentConversationName = null;
let currentConversationType = null;
let socket = null;
let friends = [];
let groups = [];
let friendRequests = [];

// Système de notifications Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') icon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    else if (type === 'error') icon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    else icon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';

    toast.innerHTML = `${icon}<span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out forwards';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// Modal de saisie
function showInputModal(title, placeholder, callback) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <input type="text" id="modal-input" placeholder="${placeholder}" style="width: 100%; padding: 10px; margin-bottom: 20px; background: var(--input-bg); border: 1px solid var(--border-color); color: var(--text-normal); border-radius: 4px;">
            <div class="modal-actions">
                <button id="modal-confirm" class="btn-primary">Valider</button>
                <button id="modal-cancel" class="btn-secondary">Annuler</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = document.getElementById('modal-input');
    input.focus();
    
    const close = () => document.body.removeChild(modal);
    
    document.getElementById('modal-confirm').onclick = () => {
        const value = input.value.trim();
        if (value) {
            callback(value);
            close();
        }
    };
    
    document.getElementById('modal-cancel').onclick = close;
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const value = input.value.trim();
            if (value) {
                callback(value);
                close();
            }
        }
    });
}

// Modal de confirmation
function showConfirmModal(title, message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${title}</h3>
            <p style="color: var(--text-normal); margin-bottom: 20px;">${message}</p>
            <div class="modal-actions">
                <button id="modal-confirm-action" class="btn-primary" style="background-color: var(--danger-color);">Confirmer</button>
                <button id="modal-cancel-action" class="btn-secondary">Annuler</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const close = () => document.body.removeChild(modal);
    
    document.getElementById('modal-confirm-action').onclick = () => {
        onConfirm();
        close();
    };
    
    document.getElementById('modal-cancel-action').onclick = close;
}

// Helper pour headers JWT
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Variables WebRTC
let localStream = null;
let peerConnection = null;
let remoteUserId = null;

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
    ],
    iceCandidatePoolSize: 10
};

// Initialisation de l'application
function initializeApp(user) {
    appCurrentUser = user;
    document.getElementById('current-user').textContent = user.username;
    
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
    
    initializeSocket();
    
    loadFriends();
    loadGroups();
    loadFriendRequests();
    
    setupTabs();
    setupEventListeners();
    setupMobileLongPress();
    setupChatFeatures();

    // Gestion bouton retour mobile
    const backBtn = document.getElementById('mobile-back-btn');
    if (backBtn) {
        backBtn.onclick = () => {
            const chatLayout = document.querySelector('.chat-layout');
            if (chatLayout) {
                chatLayout.classList.remove('mobile-chat-active');
            }
            const chatHeader = document.querySelector('.chat-header');
            if (chatHeader) {
                chatHeader.classList.remove('mobile-chat-active');
            }
            document.querySelectorAll('.list-item').forEach(item => item.classList.remove('active'));
        };
    }
}

// Configuration des onglets
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Configuration des event listeners
function setupEventListeners() {
    // Recherche d'amis locale (désactivée)
    const friendSearchInput = document.getElementById('friend-search');
    if (friendSearchInput) {
        friendSearchInput.addEventListener('input', (e) => {
            filterFriends(e.target.value);
        });
    }
    
    // Recherche d'utilisateurs
    document.getElementById('search-users-btn').addEventListener('click', searchUsers);
    document.getElementById('user-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });

    const refreshRequestsBtn = document.getElementById('refresh-requests-btn');
    if (refreshRequestsBtn) {
        refreshRequestsBtn.addEventListener('click', async () => {
            const icon = refreshRequestsBtn.querySelector('svg');
            if(icon) {
                icon.style.transition = 'transform 0.5s ease';
                icon.style.transform = 'rotate(360deg)';
                setTimeout(() => {
                    icon.style.transform = 'none';
                    icon.style.transition = 'none';
                }, 500);
            }
            await loadFriendRequests();
        });
    }
    
    document.getElementById('create-group-btn').addEventListener('click', showCreateGroupModal);
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    document.getElementById('call-btn').addEventListener('click', initiateCall);
    
    document.getElementById('end-call-btn').addEventListener('click', endCall);
    document.getElementById('accept-call-btn').addEventListener('click', acceptCall);
    document.getElementById('reject-call-btn').addEventListener('click', rejectCall);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
    
    document.getElementById('user-profile').addEventListener('click', changeAvatar);

    document.getElementById('current-conversation').addEventListener('click', () => {
        if (currentConversationType === 'group') {
            const groupId = parseInt(currentConversation.split('_')[1]);
            showGroupDetails(groupId);
        }
    });
}

let typingTimeout;
function setupChatFeatures() {
    const messageInput = document.getElementById('message-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileUpload = document.getElementById('file-upload');

    uploadBtn.addEventListener('click', () => fileUpload.click());
    fileUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/messages/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.url) {
                const type = data.mimetype.startsWith('image/') ? 'image' : 'file';
                sendMessage(null, type, data.url, data.filename);
            }
        } catch (error) {
            console.error('Erreur upload:', error);
            showToast('Erreur lors de l\'envoi du fichier', 'error');
        }
        fileUpload.value = '';
    });

    messageInput.addEventListener('input', () => {
        if (!currentConversation) return;
        
        socket.emit('typing', { conversationId: currentConversation, username: appCurrentUser.username });
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stop_typing', { conversationId: currentConversation, username: appCurrentUser.username });
        }, 2000);
    });
}

function changeAvatar() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Changer d'avatar</h3>
                <button id="modal-cancel" class="btn-icon btn-close"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display:block; margin-bottom:10px; color:var(--text-muted);">Importer une image depuis votre appareil</label>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label for="avatar-file-input" style="background-color: var(--bg-tertiary); color: var(--text-normal); text-align: center; padding: 15px; border-radius: 4px; cursor: pointer; border: 2px dashed var(--border-color); transition: all 0.2s;">
                        <span id="upload-label-text">Cliquez pour choisir une image</span>
                    </label>
                    <input type="file" id="avatar-file-input" accept="image/*" style="display: none;">
                </div>

                <button id="btn-upload-file" class="btn-primary" style="width: 100%; margin-top: 15px;">Changer la photo de profil</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const close = () => document.body.removeChild(modal);
    document.getElementById('modal-cancel').onclick = close;

    document.getElementById('avatar-file-input').onchange = function() {
        const file = this.files[0];
        const label = document.querySelector('label[for="avatar-file-input"]');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                label.innerHTML = `<img src="${e.target.result}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto;">`;
            };
            reader.readAsDataURL(file);
            
            label.style.borderColor = 'var(--accent-color)';
            label.style.backgroundColor = 'rgba(88, 101, 242, 0.1)';
            label.style.padding = '10px';
        } else {
            label.innerHTML = '<span id="upload-label-text">Cliquez pour choisir une image</span>';
            label.style.borderColor = 'var(--border-color)';
            label.style.backgroundColor = 'var(--bg-tertiary)';
            label.style.padding = '15px';
        }
    };

    document.getElementById('btn-upload-file').onclick = async () => {
        const fileInput = document.getElementById('avatar-file-input');
        const file = fileInput.files[0];
        if (!file) {
            showToast('Veuillez sélectionner un fichier', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch('/api/auth/avatar/upload', {
                method: 'POST',
                headers: headers,
                body: formData,
                credentials: 'include'
            });
            handleAvatarResponse(response, close);
        } catch (error) {
            console.error('Erreur upload:', error);
            showToast('Erreur serveur', 'error');
        }
    };
}

async function handleAvatarResponse(response, closeCallback) {
    if (response.ok) {
        const data = await response.json();
        appCurrentUser.avatar = data.avatar;
        
        const avatarContainer = document.getElementById('current-user-avatar');
        const initials = appCurrentUser.username.substring(0, 2).toUpperCase();
        avatarContainer.innerHTML = `<img src="${data.avatar}" alt="${initials}" onerror="this.onerror=null; this.parentNode.textContent='${initials}'">`;
        
        showToast('Avatar mis à jour !', 'success');
        closeCallback();
    } else {
        const err = await response.json();
        showToast(err.error || 'Erreur lors de la mise à jour', 'error');
    }
}

function changeGroupAvatar(groupId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3>Changer l'image du groupe</h3>
                <button id="modal-cancel-group" class="btn-icon btn-close"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display:block; margin-bottom:10px; color:var(--text-muted);">Importer une image depuis votre appareil</label>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <label for="group-avatar-file-input" style="background-color: var(--bg-tertiary); color: var(--text-normal); text-align: center; padding: 15px; border-radius: 4px; cursor: pointer; border: 2px dashed var(--border-color); transition: all 0.2s;">
                        <span id="upload-label-text">Cliquez pour choisir une image</span>
                    </label>
                    <input type="file" id="group-avatar-file-input" accept="image/*" style="display: none;">
                </div>

                <button id="btn-upload-group-file" class="btn-primary" style="width: 100%; margin-top: 15px;">Changer l'image</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const close = () => document.body.removeChild(modal);
    document.getElementById('modal-cancel-group').onclick = close;

    document.getElementById('group-avatar-file-input').onchange = function() {
        const file = this.files[0];
        const label = document.querySelector('label[for="group-avatar-file-input"]');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                label.innerHTML = `<img src="${e.target.result}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto;">`;
            };
            reader.readAsDataURL(file);
            
            label.style.borderColor = 'var(--accent-color)';
            label.style.backgroundColor = 'rgba(88, 101, 242, 0.1)';
            label.style.padding = '10px';
        } else {
            label.innerHTML = '<span id="upload-label-text">Cliquez pour choisir une image</span>';
            label.style.borderColor = 'var(--border-color)';
            label.style.backgroundColor = 'var(--bg-tertiary)';
            label.style.padding = '15px';
        }
    };

    document.getElementById('btn-upload-group-file').onclick = async () => {
        const fileInput = document.getElementById('group-avatar-file-input');
        const file = fileInput.files[0];
        if (!file) {
            showToast('Veuillez sélectionner un fichier', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const token = localStorage.getItem('authToken');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`/api/groups/${groupId}/avatar`, {
                method: 'POST',
                headers: headers,
                body: formData,
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const group = groups.find(g => g.id === groupId);
                if (group) {
                    group.avatar = data.avatar;
                }
                
                displayGroups();
                
                if (currentConversation === `group_${groupId}`) {
                    openConversation(`group_${groupId}`, group.name, 'group');
                }
                
                showToast('Image du groupe mise à jour !', 'success');
                close();
            } else {
                const error = await response.json();
                showToast(error.error || 'Erreur lors de la mise à jour', 'error');
            }
        } catch (error) {
            console.error('Erreur upload:', error);
            showToast('Erreur serveur', 'error');
        }
    };
}

function initializeSocket() {
    socket = io({
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        timeout: 10000
    });
    
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur Socket.io');
        socket.emit('user_online', {
            userId: appCurrentUser.id,
            username: appCurrentUser.username
        });
    });
    
    socket.on('receive_message', (data) => {
        if (currentConversation === data.conversationId) {
            displayMessage(data);
        } else {
            if (data.senderId !== appCurrentUser.id) {
                let notificationText = `Nouveau message de ${data.username}`;
                
                if (data.conversationId.startsWith('group_')) {
                    const groupId = parseInt(data.conversationId.split('_')[1]);
                    const group = groups.find(g => g.id === groupId);
                    if (group) {
                        notificationText += ` dans ${group.name}`;
                    }
                }
                
                showToast(notificationText, 'info');
                
                const navItem = document.getElementById(`nav-item-${data.conversationId}`);
                if (navItem) {
                    const badge = navItem.querySelector('.unread-badge');
                    if (badge) {
                        badge.style.display = 'block';
                    }
                }
            }
        }
    });
    
    socket.on('user_joined', (data) => {
        console.log(`${data.username} a rejoint la conversation`);
    });

    socket.on('new_friend_request', (data) => {
        console.log('📩 Nouvelle demande d\'ami reçue:', data);
        showToast(`Nouvelle demande d'ami de ${data.sender.username}`, 'info');
        loadFriendRequests();
        
        const badge = document.getElementById('requests-count');
        if (badge) {
            badge.style.transition = 'transform 0.3s ease';
            badge.style.transform = 'scale(1.5)';
            setTimeout(() => badge.style.transform = 'scale(1)', 300);
        }
    });

    socket.on('friend_request_accepted', (data) => {
        console.log('✅ Demande d\'ami acceptée par:', data.user.username);
        showToast(`${data.user.username} a accepté votre demande d'ami`, 'success');
        loadFriends();
    });

    socket.on('friend_removed', (data) => {
        console.log('❌ Ami supprimé par l\'utilisateur:', data.userId);
        loadFriends();
    });

    socket.on('user_status_change', (data) => {
        console.log('🔄 Changement de statut:', data);
        updateFriendStatus(data.userId, data.status);
    });
    
    socket.on('incoming_call', (data) => {
        window.pendingOffer = data.offer;
        remoteUserId = data.from;
        document.getElementById('caller-name').textContent = data.fromUsername;
        document.getElementById('incoming-call').style.display = 'block';
    });
    
    socket.on('call_answered', async (data) => {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('✅ Appel accepté');
        } catch (error) {
            console.error('Erreur réponse appel:', error);
        }
    });
    
    socket.on('ice_candidate', async (data) => {
        try {
            if (peerConnection && data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (error) {
            console.error('Erreur ICE candidate:', error);
        }
    });
    
    // Appel terminé
    socket.on('call_ended', () => {
        endCall();
    });

    // Typing indicators
    socket.on('user_typing', (data) => {
        if (currentConversation === data.conversationId && data.username !== appCurrentUser.username) {
            const typingIndicator = document.getElementById('typing-indicator');
            const typingText = typingIndicator.querySelector('.typing-text');
            typingText.textContent = `${data.username} écrit...`;
            typingIndicator.style.display = 'flex';
            
            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });

    socket.on('user_stop_typing', (data) => {
        if (currentConversation === data.conversationId) {
            document.getElementById('typing-indicator').style.display = 'none';
        }
    });
}

async function loadFriends() {
    try {
        const response = await fetch('/api/friends/list', { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            friends = await response.json();
            console.log('✅ Amis chargés:', friends);
            displayFriends();
        }
    } catch (error) {
        console.error('Erreur chargement amis:', error);
    }
}

async function loadGroups() {
    try {
        const response = await fetch('/api/groups/list', { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            groups = await response.json();
            displayGroups();
        }
    } catch (error) {
        console.error('Erreur chargement groupes:', error);
    }
}

async function loadFriendRequests() {
    try {
        const response = await fetch('/api/friends/requests', { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            friendRequests = await response.json();
            displayFriendRequests();
        }
    } catch (error) {
        console.error('Erreur chargement demandes:', error);
    }
}

function displayFriends() {
    const friendsList = document.getElementById('friends-list');
    const friendsCount = document.getElementById('friends-count');
    
    console.log('📋 Affichage des amis, nombre:', friends.length);
    console.log('👥 Détail des amis:', friends);
    
    friendsCount.textContent = friends.length;
    
    if (friends.length === 0) {
        friendsList.innerHTML = '<p class="empty-state">Aucun ami pour le moment</p>';
        return;
    }
    
    friendsList.innerHTML = friends.map(friend => {
        console.log('🔍 Traitement ami:', friend);
        const friendUser = friend.sender.id === appCurrentUser.id ? friend.receiver : friend.sender;
        const conversationId = `private_${Math.min(appCurrentUser.id, friendUser.id)}_${Math.max(appCurrentUser.id, friendUser.id)}`;
        
        console.log('💬 Conversation créée:', conversationId, 'pour', friendUser.username);
        
        const initials = friendUser.username.substring(0, 2).toUpperCase();
        const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
        const colorIndex = friendUser.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const avatarColor = colors[colorIndex];
        
        let avatarHtml = `<div class="avatar" style="background-color: ${avatarColor}">${initials}</div>`;
        if (friendUser.avatar) {
            avatarHtml = `<div class="avatar"><img src="${friendUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML='${initials}'; this.parentNode.style.backgroundColor='${avatarColor}'"></div>`;
        }

        return `
            <div id="nav-item-${conversationId}" class="list-item ${currentConversation === conversationId ? 'active' : ''}" onclick="openConversation('${conversationId}', '${friendUser.username}', 'private')">
                <div class="user-info">
                    ${avatarHtml}
                    <div>
                        <div class="username">${friendUser.username}</div>
                        <div class="status" id="status-${friendUser.id}" style="font-size: 12px; color: var(--text-muted);">Hors ligne</div>
                    </div>
                </div>
                <div class="unread-badge" style="display:none; background-color: var(--danger-color); width: 10px; height: 10px; border-radius: 50%; margin-right: 10px;"></div>
                <div class="status-indicator status-offline" id="indicator-${friendUser.id}" style="margin-left: auto; margin-right: 10px;"></div>
                <button class="action-btn" title="Supprimer cet ami" onclick="event.stopPropagation(); removeFriend(${friendUser.id})">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;
    }).join('');

    const friendIds = friends.map(f => (f.sender.id === appCurrentUser.id ? f.receiver.id : f.sender.id));
    if (socket && friendIds.length > 0) {
        socket.emit('check_online_status', friendIds, (onlineIds) => {
            onlineIds.forEach(id => updateFriendStatus(id, 'online'));
        });
    }
}

function updateFriendStatus(userId, status) {
    const statusText = document.getElementById(`status-${userId}`);
    const indicator = document.getElementById(`indicator-${userId}`);
    
    if (statusText && indicator) {
        if (status === 'online') {
            statusText.textContent = 'En ligne';
            statusText.style.color = 'var(--success-color)';
            indicator.classList.remove('status-offline');
            indicator.classList.add('status-online');
        } else {
            statusText.textContent = 'Hors ligne';
            statusText.style.color = 'var(--text-muted)';
            indicator.classList.remove('status-online');
            indicator.classList.add('status-offline');
        }
    }
}

function displayFriendRequests() {
    const requestsList = document.getElementById('friend-requests-list');
    const requestsCount = document.getElementById('requests-count');
    
    requestsCount.textContent = friendRequests.length;
    
    if (friendRequests.length === 0) {
        requestsList.innerHTML = '<p class="empty-state">Aucune demande</p>';
        return;
    }
    
    requestsList.innerHTML = friendRequests.map(request => {
        const initials = request.sender.username.substring(0, 2).toUpperCase();
        const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
        const colorIndex = request.sender.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const avatarColor = colors[colorIndex];

        let avatarHtml = `<div class="avatar" style="background-color: ${avatarColor}">${initials}</div>`;
        if (request.sender.avatar) {
            avatarHtml = `<div class="avatar"><img src="${request.sender.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML='${initials}'; this.parentNode.style.backgroundColor='${avatarColor}'"></div>`;
        }

        return `
        <div class="list-item">
            <div class="user-info">
                ${avatarHtml}
                <div>
                    <div class="username">${request.sender.username}</div>
                    <div class="status">Demande d'ami</div>
                </div>
            </div>
            <div class="actions">
                <button class="btn-icon btn-accept" onclick="acceptFriendRequest(${request.id})">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                </button>
                <button class="btn-icon btn-reject" onclick="rejectFriendRequest(${request.id})">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        </div>
    `}).join('');
}

function displayGroups() {
    const groupsList = document.getElementById('groups-list');
    const groupsCount = document.getElementById('groups-count');
    
    groupsCount.textContent = groups.length;
    
    if (groups.length === 0) {
        groupsList.innerHTML = '<p class="empty-state">Aucun groupe</p>';
        return;
    }
    
    groupsList.innerHTML = groups.map(group => {
        const conversationId = `group_${group.id}`;
        const initials = group.name.substring(0, 2).toUpperCase();
        const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
        const colorIndex = group.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const avatarColor = colors[colorIndex];

        let avatarHtml = `<div class="avatar" style="background-color: ${avatarColor}">${initials}</div>`;
        if (group.avatar) {
            avatarHtml = `<div class="avatar"><img src="${group.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML='${initials}'; this.parentNode.style.backgroundColor='${avatarColor}'"></div>`;
        }

        return `
            <div id="nav-item-${conversationId}" class="list-item ${currentConversation === conversationId ? 'active' : ''}" onclick="openConversation('${conversationId}', '${group.name}', 'group')">
                <div class="user-info">
                    ${avatarHtml}
                    <div>
                        <div class="username">${group.name}</div>
                        <div class="status">${group.members?.length || 0} membres</div>
                    </div>
                </div>
                <div class="unread-badge" style="display:none; background-color: var(--danger-color); width: 10px; height: 10px; border-radius: 50%; margin-right: 10px;"></div>
                <button class="action-btn" title="Quitter le groupe" onclick="event.stopPropagation(); leaveGroup(${group.id})">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg>
                </button>
            </div>
        `;
    }).join('');
}

function filterFriends(searchTerm) {
    const items = document.querySelectorAll('#friends-list .list-item');
    items.forEach(item => {
        const name = item.querySelector('.item-name').textContent.toLowerCase();
        if (name.includes(searchTerm.toLowerCase())) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

async function searchUsers() {
    const searchTerm = document.getElementById('user-search').value.trim();
    console.log('🔍 Recherche d\'utilisateurs:', searchTerm);
    
    if (!searchTerm) {
        document.getElementById('search-results').innerHTML = '<p class="empty-state">Recherchez des utilisateurs à ajouter</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/friends/search?query=${encodeURIComponent(searchTerm)}`, {
            credentials: 'include',
            headers: getAuthHeaders()
        });
        console.log('📡 Réponse recherche:', response.status);
        
        if (response.ok) {
            const users = await response.json();
            console.log('✅ Utilisateurs trouvés:', users);
            displaySearchResults(users);
        } else {
            console.error('❌ Erreur recherche:', response.status);
            document.getElementById('search-results').innerHTML = '<p class="empty-state">Erreur de recherche</p>';
        }
    } catch (error) {
        console.error('Erreur recherche utilisateurs:', error);
        document.getElementById('search-results').innerHTML = '<p class="empty-state">Erreur de connexion</p>';
    }
}

function displaySearchResults(users) {
    const searchResults = document.getElementById('search-results');
    
    if (users.length === 0) {
        searchResults.innerHTML = '<p class="empty-state">Aucun utilisateur trouvé</p>';
        return;
    }
    
    searchResults.innerHTML = users.map(user => {
        const initials = user.username.substring(0, 2).toUpperCase();
        const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
        const colorIndex = user.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const avatarColor = colors[colorIndex];

        let avatarHtml = `<div class="avatar" style="background-color: ${avatarColor}">${initials}</div>`;
        if (user.avatar) {
            avatarHtml = `<div class="avatar"><img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.innerHTML='${initials}'; this.parentNode.style.backgroundColor='${avatarColor}'"></div>`;
        }

        return `
        <div class="list-item">
            <div class="user-info">
                ${avatarHtml}
                <div>
                    <div class="username">${user.username}</div>
                    <div class="status">${user.email}</div>
                </div>
            </div>
            <button class="btn-icon btn-accept" onclick="sendFriendRequest(${user.id})">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="vertical-align: text-bottom;"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Ajouter
            </button>
        </div>
    `}).join('');
}

async function sendFriendRequest(userId) {
    try {
        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ receiverId: userId }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Demande d\'ami envoyée !', 'success');
        } else {
            const error = await response.json();
            showToast(error.error, 'error');
        }
    } catch (error) {
        console.error('Erreur envoi demande:', error);
        showToast('Erreur lors de l\'envoi de la demande', 'error');
    }
}

async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/accept/${requestId}`, { 
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            await loadFriendRequests();
            await loadFriends();
            showToast('Ami ajouté !', 'success');
        }
    } catch (error) {
        console.error('Erreur acceptation demande:', error);
    }
}

async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/request/${requestId}`, { 
            method: 'DELETE',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            await loadFriendRequests();
            showToast('Demande refusée', 'info');
        }
    } catch (error) {
        console.error('Erreur refus demande:', error);
    }
}

function showCreateGroupModal() {
    showInputModal('Créer un groupe', 'Nom du groupe', (groupName) => {
        if (friends.length === 0) {
            showToast('Vous devez avoir des amis pour créer un groupe', 'error');
            return;
        }
        
        let membersHtml = '<div style="max-height: 300px; overflow-y: auto;">';
        friends.forEach(friend => {
            const friendUser = friend.sender.id === appCurrentUser.id ? friend.receiver : friend.sender;
            membersHtml += `
                <label style="display: block; margin: 10px 0;">
                    <input type="checkbox" value="${friendUser.id}" class="member-checkbox">
                    ${friendUser.username}
                </label>
            `;
        });
        membersHtml += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Sélectionner les membres</h3>
                ${membersHtml}
                <div class="modal-actions">
                    <button id="confirm-group" class="btn-primary">Créer</button>
                    <button id="cancel-group" class="btn-secondary">Annuler</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('confirm-group').onclick = async () => {
            const checkboxes = modal.querySelectorAll('.member-checkbox:checked');
            const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
            
            if (memberIds.length === 0) {
                showToast('Sélectionnez au moins un membre', 'error');
                return;
            }
            
            await createGroup(groupName, memberIds);
            document.body.removeChild(modal);
        };
        
        document.getElementById('cancel-group').onclick = () => {
            document.body.removeChild(modal);
        };
    });
}

async function createGroup(name, memberIds) {
    try {
        const response = await fetch('/api/groups/create', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, memberIds }),
            credentials: 'include'
        });
        
        if (response.ok) {
            await loadGroups();
            showToast('Groupe créé !', 'success');
        } else {
            const error = await response.json();
            showToast(error.error, 'error');
        }
    } catch (error) {
        console.error('Erreur création groupe:', error);
        showToast('Erreur lors de la création du groupe', 'error');
    }
}

function openConversation(conversationId, name, type) {
    currentConversation = conversationId;
    currentConversationName = name;
    currentConversationType = type;
    
    const navItem = document.getElementById(`nav-item-${conversationId}`);
    if (navItem) {
        const badge = navItem.querySelector('.unread-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }

    if (type === 'private') {
        const parts = conversationId.split('_');
        const userId1 = parseInt(parts[1]);
        const userId2 = parseInt(parts[2]);
        remoteUserId = userId1 === appCurrentUser.id ? userId2 : userId1;
    }
    
    const headerTitle = document.getElementById('current-conversation');
    headerTitle.textContent = name;
    
    if (type === 'group') {
        headerTitle.style.cursor = 'pointer';
        headerTitle.title = 'Voir les infos du groupe';
    } else {
        headerTitle.style.cursor = 'default';
        headerTitle.title = '';
    }

    const chatLayout = document.querySelector('.chat-layout');
    if (chatLayout) {
        chatLayout.classList.add('mobile-chat-active');
    }
    
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        chatHeader.classList.add('mobile-chat-active');
    }
    
    const headerLeft = document.querySelector('.header-left');
    const existingAvatar = headerLeft.querySelector('.header-avatar');
    if (existingAvatar) existingAvatar.remove();

    let avatarHtml = '';
    let canChangeAvatar = false;
    let groupId = null;

    if (type === 'group') {
        groupId = parseInt(conversationId.split('_')[1]);
        const group = groups.find(g => g.id === groupId);
        if (group) {
             const initials = group.name.substring(0, 2).toUpperCase();
             const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
             const colorIndex = group.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
             const avatarColor = colors[colorIndex];
             
             if (group.avatar) {
                 avatarHtml = `<div class="header-avatar avatar" style="margin-right: 8px; cursor: pointer;"><img src="${group.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
             } else {
                 avatarHtml = `<div class="header-avatar avatar" style="background-color: ${avatarColor}; margin-right: 8px; cursor: pointer;">${initials}</div>`;
             }

             if (group.creatorId === appCurrentUser.id) {
                 canChangeAvatar = true;
             }
        }
    } else if (type === 'private') {
        const parts = conversationId.split('_');
        const userId1 = parseInt(parts[1]);
        const userId2 = parseInt(parts[2]);
        const otherUserId = userId1 === appCurrentUser.id ? userId2 : userId1;
        
        const friendObj = friends.find(f => (f.sender.id === otherUserId) || (f.receiver.id === otherUserId));
        if (friendObj) {
             const friendUser = friendObj.sender.id === otherUserId ? friendObj.sender : friendObj.receiver;
             const initials = friendUser.username.substring(0, 2).toUpperCase();
             const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
             const colorIndex = friendUser.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
             const avatarColor = colors[colorIndex];

             if (friendUser.avatar) {
                 avatarHtml = `<div class="header-avatar avatar" style="margin-right: 8px;"><img src="${friendUser.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></div>`;
             } else {
                 avatarHtml = `<div class="header-avatar avatar" style="background-color: ${avatarColor}; margin-right: 8px;">${initials}</div>`;
             }
        }
    }

    if (avatarHtml) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = avatarHtml;
        const avatarEl = tempDiv.firstChild;
        
        const logo = headerLeft.querySelector('.logo');
        if (logo) logo.style.display = 'block';

        if (logo && logo.nextSibling) {
             headerLeft.insertBefore(avatarEl, logo.nextSibling);
        } else {
             headerLeft.insertBefore(avatarEl, headerLeft.firstChild);
        }

        if (canChangeAvatar && type === 'group') {
            avatarEl.title = "Changer l'image du groupe";
            avatarEl.onclick = (e) => {
                e.stopPropagation();
                changeGroupAvatar(groupId);
            };
        }
    } else {
        const logo = headerLeft.querySelector('.logo');
        if (logo) logo.style.display = 'block';
    }

    const headerRight = document.querySelector('.chat-header .header-right');
    const existingActions = headerRight.querySelectorAll('.header-action-btn');
    existingActions.forEach(btn => btn.remove());

    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-area').style.display = 'flex';
    
    if (typeof event !== 'undefined' && event && event.target) {
        const listItem = event.target.closest('.list-item');
        if (listItem) {
            document.querySelectorAll('.list-item').forEach(item => item.classList.remove('active'));
            listItem.classList.add('active');
        }
    }
    
    // Rejoindre la conversation via Socket.io
    socket.emit('join_conversation', {
        conversationId,
        userId: appCurrentUser.id,
        username: appCurrentUser.username
    });
    
    // Charger les messages
    loadMessages(conversationId);
}

// Charger les messages
async function loadMessages(conversationId) {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '<p style="text-align: center; color: #999;">Chargement des messages...</p>';
    
    try {
        const response = await fetch(`/api/messages/${conversationId}`, { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            const messages = await response.json();
            messagesContainer.innerHTML = '';
            messages.forEach(msg => displayMessage(msg));
        } else {
            messagesContainer.innerHTML = '<p style="text-align: center; color: #999;">Aucun message</p>';
        }
    } catch (error) {
        console.error('Erreur chargement messages:', error);
        messagesContainer.innerHTML = '<p style="text-align: center; color: #999;">Aucun message</p>';
    }
}

// Afficher un message
function displayMessage(data) {
    const messagesContainer = document.getElementById('chat-messages');
    const isOwn = data.senderId === appCurrentUser.id || data.username === appCurrentUser.username;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = data.id || data._id;
    
    const dateObj = new Date(data.timestamp || data.createdAt);
    const messageTime = dateObj.toLocaleDateString('fr-FR') + ' ' + dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    const username = data.username || 'Utilisateur';
    const initials = username.substring(0, 2).toUpperCase();
    
    const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
    const colorIndex = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    const avatarColor = colors[colorIndex];

    let avatarHtml = `<div class="message-avatar" style="background-color: ${avatarColor}">${initials}</div>`;
    
    if (data.avatar) {
        avatarHtml = `<img src="${data.avatar}" class="message-avatar" alt="${initials}" onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\'message-avatar\' style=\'background-color: ${avatarColor}\'>${initials}</div>'">`;
    }

    let contentHtml = '';
    
    const isImage = data.type === 'image' || (data.fileUrl && data.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i));
    const isFile = data.type === 'file' || (data.fileUrl && !isImage);

    if (isImage && data.fileUrl) {
        contentHtml = `<div class="message-image-container">
            <img src="${data.fileUrl}" class="message-image" alt="Image partagée" onclick="window.open(this.src, '_blank')">
        </div>`;
    } else if (isFile && data.fileUrl) {
        contentHtml = `<div class="message-file">
            <a href="${data.fileUrl}" target="_blank" class="file-link" download>
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style="vertical-align: middle; margin-right: 8px;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                ${data.message || 'Fichier'}
            </a>
        </div>`;
    } else {
        contentHtml = `<div class="message-text">${data.message || data.content}</div>`;
    }

    messageDiv.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${username}</span>
                <span class="message-time">${messageTime}</span>
            </div>
            ${contentHtml}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage(e, type = 'text', content = null, filename = null) {
    if (e) e.preventDefault();
    
    if (!currentConversation) {
        showToast('Sélectionnez une conversation', 'error');
        return;
    }
    
    let messageContent;
    let fileUrl = null;

    if (type === 'text') {
        const input = document.getElementById('message-input');
        messageContent = input.value.trim();
        if (!messageContent) return;
        input.value = '';
        
        socket.emit('stop_typing', { conversationId: currentConversation, username: appCurrentUser.username });
    } else if (type === 'image') {
        messageContent = 'Image';
        fileUrl = content;
    } else if (type === 'file') {
        messageContent = filename || 'Fichier';
        fileUrl = content;
    }
    
    socket.emit('send_message', {
        conversationId: currentConversation,
        message: messageContent,
        type: type,
        fileUrl: fileUrl,
        username: appCurrentUser.username,
        senderId: appCurrentUser.id,
        avatar: appCurrentUser.avatar,
        timestamp: new Date()
    });
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { 
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        location.reload();
    } catch (error) {
        console.error('Erreur déconnexion:', error);
        location.reload();
    }
}

async function initiateCall() {
    if (!currentConversation) {
        showToast('Sélectionnez une conversation', 'error');
        return;
    }
    
    if (currentConversationType !== 'private') {
        showToast('Les appels vidéo ne sont disponibles que pour les conversations privées', 'error');
        return;
    }
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('call-container').style.display = 'block';
        document.getElementById('call-status').textContent = 'Appel en cours...';
        
        peerConnection = new RTCPeerConnection(iceServers);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
            document.getElementById('call-status').textContent = `En appel avec ${currentConversationName}`;
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remoteUserId,
                    candidate: event.candidate
                });
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('call_offer', {
            to: remoteUserId,
            offer: offer,
            from: socket.id,
            fromUsername: appCurrentUser.username
        });
        
    } catch (error) {
        console.error('Erreur initiation appel:', error);
        showToast('Erreur lors de l\'accès à la caméra/micro', 'error');
        endCall();
    }
}

async function acceptCall() {
    document.getElementById('incoming-call').style.display = 'none';
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('call-container').style.display = 'block';
        document.getElementById('call-status').textContent = 'En appel...';
        
        peerConnection = new RTCPeerConnection(iceServers);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remoteUserId,
                    candidate: event.candidate
                });
            }
        };
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('call_answer', {
            to: remoteUserId,
            answer: answer
        });
        
    } catch (error) {
        console.error('Erreur acceptation appel:', error);
        showToast('Erreur lors de l\'accès à la caméra/micro', 'error');
        endCall();
    }
}

function rejectCall() {
    document.getElementById('incoming-call').style.display = 'none';
    
    socket.emit('end_call', {
        to: remoteUserId
    });
    
    remoteUserId = null;
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    document.getElementById('call-container').style.display = 'none';
    document.getElementById('incoming-call').style.display = 'none';
    
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    if (remoteUserId) {
        socket.emit('end_call', {
            to: remoteUserId
        });
        remoteUserId = null;
    }
}

function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio');
            btn.innerHTML = audioTrack.enabled ? 
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>' : 
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l2.97 2.97c-.85.35-1.76.57-2.71.5-2.38-.18-4.49-1.92-4.9-4.29H6c.52 3.34 3.16 6.05 6.5 6.43V21h1v-3.35c.57-.07 1.12-.2 1.64-.38l3.59 3.59L20 19.73 4.27 3z"/></svg>';
            btn.style.background = audioTrack.enabled ? '#444' : '#f44336';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('toggle-video');
            btn.innerHTML = videoTrack.enabled ? 
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>' : 
                '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>';
            btn.style.background = videoTrack.enabled ? '#444' : '#f44336';
        }
    }
}

function showTransferModal(groupId, members) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let membersHtml = '<div style="max-height: 300px; overflow-y: auto;">';
    members.forEach(member => {
        membersHtml += `
            <label style="display: flex; align-items: center; margin: 10px 0; cursor: pointer; padding: 10px; background: var(--bg-tertiary); border-radius: 4px;">
                <input type="radio" name="newCreator" value="${member.userId}" style="margin-right: 10px;">
                <span>${member.user.username}</span>
            </label>
        `;
    });
    membersHtml += '</div>';

    modal.innerHTML = `
        <div class="modal-content">
            <h3>Transférer la propriété</h3>
            <p style="color: var(--text-muted); margin-bottom: 15px;">Vous êtes l'administrateur. Veuillez désigner un nouveau chef avant de quitter.</p>
            ${membersHtml}
            <div class="modal-actions">
                <button id="confirm-transfer" class="btn-primary">Transférer et Quitter</button>
                <button id="cancel-transfer" class="btn-secondary">Annuler</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('cancel-transfer').onclick = () => document.body.removeChild(modal);
    
    document.getElementById('confirm-transfer').onclick = async () => {
        const selected = modal.querySelector('input[name="newCreator"]:checked');
        if (!selected) {
            showToast('Veuillez sélectionner un membre', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/groups/${groupId}/leave`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ newCreatorId: selected.value }),
                credentials: 'include'
            });

            if (response.ok) {
                showToast('Propriété transférée et groupe quitté', 'success');
                document.body.removeChild(modal);
                await loadGroups();
                document.getElementById('welcome-screen').style.display = 'flex';
                document.getElementById('chat-area').style.display = 'none';
                resetChatHeader();
                currentConversation = null;
            } else {
                const data = await response.json();
                showToast(data.error, 'error');
            }
        } catch (error) {
            console.error('Erreur transfert:', error);
            showToast('Erreur serveur', 'error');
        }
    };
}

async function removeFriend(friendId) {
    showConfirmModal('Supprimer un ami', 'Voulez-vous vraiment supprimer cet ami ?', async () => {
        try {
            const response = await fetch(`/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
                credentials: 'include'
            });

            if (response.ok) {
                showToast('Ami supprimé', 'success');
                await loadFriends();
                document.getElementById('welcome-screen').style.display = 'flex';
                document.getElementById('chat-area').style.display = 'none';
                resetChatHeader();
                currentConversation = null;
            } else {
                const data = await response.json();
                showToast(data.error, 'error');
            }
        } catch (error) {
            console.error('Erreur suppression ami:', error);
            showToast('Erreur serveur', 'error');
        }
    });
}

function resetChatHeader() {
    document.getElementById('current-conversation').textContent = 'Sélectionnez une conversation';
    
    const headerLeft = document.querySelector('.header-left');
    const avatar = headerLeft.querySelector('.header-avatar');
    if (avatar) avatar.remove();
    
    const logo = headerLeft.querySelector('.logo');
    if (logo) logo.style.display = 'block';
    
    const headerRight = document.querySelector('.header-right');
    const actions = headerRight.querySelectorAll('.header-action-btn');
    actions.forEach(btn => btn.remove());

    const chatLayout = document.querySelector('.chat-layout');
    if (chatLayout) {
        chatLayout.classList.remove('mobile-chat-active');
    }

    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        chatHeader.classList.remove('mobile-chat-active');
    }
}

function setupMobileLongPress() {
    let pressTimer;
    let isLongPress = false;
    let startX, startY;

    const handleTouchStart = (e) => {
        const item = e.target.closest('.list-item');
        if (!item) return;

        isLongPress = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;

        pressTimer = setTimeout(() => {
            isLongPress = true;
            
            document.querySelectorAll('.list-item.show-actions').forEach(el => {
                if (el !== item) el.classList.remove('show-actions');
            });

            item.classList.add('show-actions');
            
            if (navigator.vibrate) navigator.vibrate(50);
        }, 500);
    };

    const handleTouchEnd = (e) => {
        clearTimeout(pressTimer);
        if (isLongPress) {
            if (e.cancelable) e.preventDefault();
            isLongPress = false;
        }
    };

    const handleTouchMove = (e) => {
        const diffX = Math.abs(e.touches[0].clientX - startX);
        const diffY = Math.abs(e.touches[0].clientY - startY);
        
        if (diffX > 10 || diffY > 10) {
            clearTimeout(pressTimer);
        }
    };

    const lists = ['friends-list', 'groups-list'];
    lists.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('touchstart', handleTouchStart, { passive: false });
            el.addEventListener('touchend', handleTouchEnd, { passive: false });
            el.addEventListener('touchmove', handleTouchMove, { passive: true });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
             document.querySelectorAll('.list-item.show-actions').forEach(el => {
                el.classList.remove('show-actions');
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check', { credentials: 'include' });
        if (response.ok) {
            const user = await response.json();
            if (user.user) {
                initializeApp(user.user);
            }
        }
    } catch (error) {
        console.error('Erreur vérification session:', error);
    }
});
