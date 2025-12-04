// Variables globales
let appCurrentUser = null;
let currentConversation = null;
let currentConversationName = null;
let currentConversationType = null;
let socket = null;
let friends = [];
let groups = [];
let friendRequests = [];

// Fonction helper pour ajouter le token JWT aux requêtes
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

// Variables pour WebRTC
let localStream = null;
let peerConnection = null;
let remoteUserId = null;

const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Initialisation après connexion
function initializeApp(user) {
    appCurrentUser = user;
    document.getElementById('current-user').textContent = user.username;
    
    // Masquer l'auth, afficher le chat
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    
    // Initialiser Socket.io
    initializeSocket();
    
    // Charger les données
    loadFriends();
    loadGroups();
    loadFriendRequests();
    
    // Event listeners pour les tabs
    setupTabs();
    
    // Event listeners pour les boutons
    setupEventListeners();
}

// Configuration des tabs
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Retirer active de tous
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Ajouter active au sélectionné
            btn.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Configuration des event listeners
function setupEventListeners() {
    // Recherche d'amis locale
    document.getElementById('friend-search').addEventListener('input', (e) => {
        filterFriends(e.target.value);
    });
    
    // Recherche d'utilisateurs
    document.getElementById('search-users-btn').addEventListener('click', searchUsers);
    document.getElementById('user-search').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUsers();
    });
    
    // Créer un groupe
    document.getElementById('create-group-btn').addEventListener('click', showCreateGroupModal);
    
    // Déconnexion
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Envoi de message
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Bouton d'appel
    document.getElementById('call-btn').addEventListener('click', initiateCall);
    
    // Boutons de contrôle d'appel
    document.getElementById('end-call-btn').addEventListener('click', endCall);
    document.getElementById('accept-call-btn').addEventListener('click', acceptCall);
    document.getElementById('reject-call-btn').addEventListener('click', rejectCall);
    document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
    document.getElementById('toggle-video').addEventListener('click', toggleVideo);
}

// Initialiser Socket.io
function initializeSocket() {
    socket = io();
    
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
        }
    });
    
    socket.on('user_joined', (data) => {
        console.log(`${data.username} a rejoint la conversation`);
    });
    
    // Appel entrant
    socket.on('incoming_call', (data) => {
        window.pendingOffer = data.offer;
        remoteUserId = data.from;
        document.getElementById('caller-name').textContent = data.fromUsername;
        document.getElementById('incoming-call').style.display = 'block';
    });
    
    // Appel accepté
    socket.on('call_answered', async (data) => {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            console.log('✅ Appel accepté');
        } catch (error) {
            console.error('Erreur réponse appel:', error);
        }
    });
    
    // Nouveau candidat ICE
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
}

// Charger les amis
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

// Charger les groupes
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

// Charger les demandes d'amis
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

// Afficher les amis
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
        
        return `
            <div class="list-item ${currentConversation === conversationId ? 'active' : ''}" onclick="openConversation('${conversationId}', '${friendUser.username}', 'private')">
                <div class="item-info">
                    <div class="item-name">👤 ${friendUser.username}</div>
                    <div class="item-status">En ligne</div>
                </div>
            </div>
        `;
    }).join('');
}

// Afficher les demandes d'amis
function displayFriendRequests() {
    const requestsList = document.getElementById('friend-requests-list');
    const requestsCount = document.getElementById('requests-count');
    
    requestsCount.textContent = friendRequests.length;
    
    if (friendRequests.length === 0) {
        requestsList.innerHTML = '<p class="empty-state">Aucune demande</p>';
        return;
    }
    
    requestsList.innerHTML = friendRequests.map(request => `
        <div class="list-item">
            <div class="item-info">
                <div class="item-name">👤 ${request.sender.username}</div>
                <div class="item-status">Demande d'ami</div>
            </div>
            <div class="item-actions">
                <button class="btn-small btn-accept" onclick="acceptFriendRequest(${request.id})">✓</button>
                <button class="btn-small btn-reject" onclick="rejectFriendRequest(${request.id})">✗</button>
            </div>
        </div>
    `).join('');
}

// Afficher les groupes
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
        return `
            <div class="list-item ${currentConversation === conversationId ? 'active' : ''}" onclick="openConversation('${conversationId}', '${group.name}', 'group')">
                <div class="item-info">
                    <div class="item-name">👨‍👩‍👧‍👦 ${group.name}</div>
                    <div class="item-status">${group.members?.length || 0} membres</div>
                </div>
            </div>
        `;
    }).join('');
}

// Filtrer les amis
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

// Rechercher des utilisateurs
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

// Afficher les résultats de recherche
function displaySearchResults(users) {
    const searchResults = document.getElementById('search-results');
    
    if (users.length === 0) {
        searchResults.innerHTML = '<p class="empty-state">Aucun utilisateur trouvé</p>';
        return;
    }
    
    searchResults.innerHTML = users.map(user => `
        <div class="list-item">
            <div class="item-info">
                <div class="item-name">👤 ${user.username}</div>
                <div class="item-status">${user.email}</div>
            </div>
            <button class="btn-small btn-add" onclick="sendFriendRequest(${user.id})">+ Ajouter</button>
        </div>
    `).join('');
}

// Envoyer une demande d'ami
async function sendFriendRequest(userId) {
    try {
        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ receiverId: userId }),
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('✅ Demande d\'ami envoyée !');
        } else {
            const error = await response.json();
            alert('❌ ' + error.error);
        }
    } catch (error) {
        console.error('Erreur envoi demande:', error);
        alert('❌ Erreur lors de l\'envoi de la demande');
    }
}

// Accepter une demande d'ami
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
            alert('✅ Ami ajouté !');
        }
    } catch (error) {
        console.error('Erreur acceptation demande:', error);
    }
}

// Refuser une demande d'ami
async function rejectFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/request/${requestId}`, { 
            method: 'DELETE',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            await loadFriendRequests();
            alert('✅ Demande refusée');
        }
    } catch (error) {
        console.error('Erreur refus demande:', error);
    }
}

// Modal pour créer un groupe
function showCreateGroupModal() {
    const groupName = prompt('Nom du groupe :');
    if (!groupName) return;
    
    if (friends.length === 0) {
        alert('❌ Vous devez avoir des amis pour créer un groupe');
        return;
    }
    
    // Sélection des membres
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
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%;">
            <h3 style="margin-bottom: 20px;">Sélectionner les membres</h3>
            ${membersHtml}
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <button id="confirm-group" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">Créer</button>
                <button id="cancel-group" style="flex: 1; padding: 10px; background: #ccc; color: #333; border: none; border-radius: 5px; cursor: pointer;">Annuler</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('confirm-group').onclick = async () => {
        const checkboxes = modal.querySelectorAll('.member-checkbox:checked');
        const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (memberIds.length === 0) {
            alert('❌ Sélectionnez au moins un membre');
            return;
        }
        
        await createGroup(groupName, memberIds);
        document.body.removeChild(modal);
    };
    
    document.getElementById('cancel-group').onclick = () => {
        document.body.removeChild(modal);
    };
}

// Créer un groupe
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
            alert('✅ Groupe créé !');
        } else {
            const error = await response.json();
            alert('❌ ' + error.error);
        }
    } catch (error) {
        console.error('Erreur création groupe:', error);
        alert('❌ Erreur lors de la création du groupe');
    }
}

// Ouvrir une conversation
function openConversation(conversationId, name, type) {
    currentConversation = conversationId;
    currentConversationName = name;
    currentConversationType = type;
    
    // Pour les conversations privées, extraire l'ID de l'ami
    if (type === 'private') {
        const parts = conversationId.split('_');
        const userId1 = parseInt(parts[1]);
        const userId2 = parseInt(parts[2]);
        remoteUserId = userId1 === appCurrentUser.id ? userId2 : userId1;
    }
    
    // Mettre à jour l'UI
    document.getElementById('current-conversation').textContent = name;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('chat-area').style.display = 'flex';
    
    // Mettre à jour les items actifs
    document.querySelectorAll('.list-item').forEach(item => item.classList.remove('active'));
    event.target.closest('.list-item')?.classList.add('active');
    
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
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${!isOwn ? `<div class="message-header">${data.username || 'Utilisateur'}</div>` : ''}
            <div class="message-text">${data.message || data.content}</div>
            <div class="message-time">${new Date(data.timestamp || data.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Envoyer un message
function sendMessage() {
    if (!currentConversation) {
        alert('❌ Sélectionnez une conversation');
        return;
    }
    
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    socket.emit('send_message', {
        conversationId: currentConversation,
        message,
        username: appCurrentUser.username,
        senderId: appCurrentUser.id,
        timestamp: new Date()
    });
    
    input.value = '';
}

// Déconnexion
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

// ===== FONCTIONS D'APPEL VIDÉO =====

// Initier un appel
async function initiateCall() {
    if (!currentConversation) {
        alert('❌ Sélectionnez une conversation');
        return;
    }
    
    if (currentConversationType !== 'private') {
        alert('❌ Les appels vidéo ne sont disponibles que pour les conversations privées');
        return;
    }
    
    try {
        // Obtenir le flux local
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('call-container').style.display = 'block';
        document.getElementById('call-status').textContent = 'Appel en cours...';
        
        // Créer la connexion peer
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Ajouter les tracks locaux
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Gérer les tracks distants
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
            document.getElementById('call-status').textContent = `En appel avec ${currentConversationName}`;
        };
        
        // Gérer les candidats ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remoteUserId,
                    candidate: event.candidate
                });
            }
        };
        
        // Créer et envoyer l'offre
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Envoyer l'offre via Socket.io au bon utilisateur
        socket.emit('call_offer', {
            to: remoteUserId,
            offer: offer,
            from: socket.id,
            fromUsername: appCurrentUser.username
        });
        
    } catch (error) {
        console.error('Erreur initiation appel:', error);
        alert('❌ Erreur lors de l\'accès à la caméra/micro');
        endCall();
    }
}

// Accepter un appel entrant
async function acceptCall() {
    document.getElementById('incoming-call').style.display = 'none';
    
    try {
        // Obtenir le flux local
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        document.getElementById('local-video').srcObject = localStream;
        document.getElementById('call-container').style.display = 'block';
        document.getElementById('call-status').textContent = 'En appel...';
        
        // Créer la connexion peer
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Ajouter les tracks locaux
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Gérer les tracks distants
        peerConnection.ontrack = (event) => {
            document.getElementById('remote-video').srcObject = event.streams[0];
        };
        
        // Gérer les candidats ICE
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remoteUserId,
                    candidate: event.candidate
                });
            }
        };
        
        // Définir l'offre distante et créer la réponse
        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Envoyer la réponse
        socket.emit('call_answer', {
            to: remoteUserId,
            answer: answer
        });
        
    } catch (error) {
        console.error('Erreur acceptation appel:', error);
        alert('❌ Erreur lors de l\'accès à la caméra/micro');
        endCall();
    }
}

// Refuser un appel
function rejectCall() {
    document.getElementById('incoming-call').style.display = 'none';
    
    socket.emit('end_call', {
        to: remoteUserId
    });
    
    remoteUserId = null;
}

// Terminer un appel
function endCall() {
    // Arrêter tous les tracks locaux
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Fermer la connexion peer
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Masquer l'interface d'appel
    document.getElementById('call-container').style.display = 'none';
    document.getElementById('incoming-call').style.display = 'none';
    
    // Nettoyer les vidéos
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    // Notifier l'autre utilisateur
    if (remoteUserId) {
        socket.emit('end_call', {
            to: remoteUserId
        });
        remoteUserId = null;
    }
}

// Toggle audio
function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio');
            btn.textContent = audioTrack.enabled ? '🎤 Micro' : '🔇 Micro coupé';
            btn.style.background = audioTrack.enabled ? '#444' : '#f44336';
        }
    }
}

// Toggle vidéo
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('toggle-video');
            btn.textContent = videoTrack.enabled ? '📹 Vidéo' : '📹 Vidéo coupée';
            btn.style.background = videoTrack.enabled ? '#444' : '#f44336';
        }
    }
}

// Vérifier la session au chargement
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
