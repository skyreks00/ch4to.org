// Gestion du chat et WebRTC

let socket;
let chatCurrentUser; // Renommé pour éviter les conflits
let peerConnection;
let localStream;
let remoteStream;
let isCallActive = false;
let remotePeerId = null;

const ROOM = 'general'; // Salle par défaut

// Configuration STUN/TURN pour WebRTC
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Variables pour les éléments DOM
let messagesContainer;
let messageInput;
let sendBtn;
let callBtn;
let callContainer;
let incomingCallContainer;
let localVideo;
let remoteVideo;
let endCallBtn;
let acceptCallBtn;
let rejectCallBtn;
let toggleAudioBtn;
let toggleVideoBtn;
let callerNameSpan;
let callStatusSpan;

// Initialiser le chat
function initializeChat(user) {
    chatCurrentUser = user;
    
    // Récupérer les éléments du DOM
    messagesContainer = document.getElementById('chat-messages');
    messageInput = document.getElementById('message-input');
    sendBtn = document.getElementById('send-btn');
    callBtn = document.getElementById('call-btn');
    callContainer = document.getElementById('call-container');
    incomingCallContainer = document.getElementById('incoming-call');
    localVideo = document.getElementById('local-video');
    remoteVideo = document.getElementById('remote-video');
    endCallBtn = document.getElementById('end-call-btn');
    acceptCallBtn = document.getElementById('accept-call-btn');
    rejectCallBtn = document.getElementById('reject-call-btn');
    toggleAudioBtn = document.getElementById('toggle-audio');
    toggleVideoBtn = document.getElementById('toggle-video');
    callerNameSpan = document.getElementById('caller-name');
    callStatusSpan = document.getElementById('call-status');
    
    // Attacher les événements
    setupEventListeners();
    
    // Connexion Socket.io
    socket = io(window.location.origin);
    
    socket.on('connect', () => {
        console.log('✅ Connecté au serveur Socket.io');
        console.log('📞 Votre ID Socket pour les appels:', socket.id);
        console.log('💡 Copiez cet ID et partagez-le pour recevoir des appels');
        
        // Rejoindre la salle
        socket.emit('join_room', {
            room: ROOM,
            username: chatCurrentUser.username
        });
        
        // Charger l'historique des messages
        loadMessageHistory();
    });
    
    // Recevoir un message
    socket.on('receive_message', (data) => {
        displayMessage(data);
    });
    
    // Utilisateur a rejoint
    socket.on('user_joined', (data) => {
        displaySystemMessage(`${data.username} a rejoint le chat`);
    });
    
    // Utilisateur a quitté
    socket.on('user_left', (data) => {
        displaySystemMessage(`${data.username} a quitté le chat`);
    });
    
    // Appel entrant
    socket.on('incoming_call', async (data) => {
        remotePeerId = data.from;
        callerNameSpan.textContent = data.fromUsername;
        incomingCallContainer.style.display = 'flex';
        
        // Stocker l'offre pour quand on accepte
        window.pendingOffer = data.offer;
    });
    
    // Appel accepté
    socket.on('call_answered', async (data) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        callStatusSpan.textContent = 'Appel connecté';
    });
    
    // ICE Candidate
    socket.on('ice_candidate', async (data) => {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('Erreur ajout ICE candidate:', error);
        }
    });
    
    // Appel terminé
    socket.on('call_ended', () => {
        endCall();
    });
}

// Configurer tous les event listeners
function setupEventListeners() {
    // Envoyer un message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Initier un appel
    callBtn.addEventListener('click', initiateCall);
    
    // Accepter un appel
    acceptCallBtn.addEventListener('click', acceptCall);
    
    // Refuser un appel
    rejectCallBtn.addEventListener('click', rejectCall);
    
    // Terminer un appel
    endCallBtn.addEventListener('click', endCallHandler);
    
    // Toggle audio
    toggleAudioBtn.addEventListener('click', toggleAudio);
    
    // Toggle vidéo
    toggleVideoBtn.addEventListener('click', toggleVideo);
}

function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message === '') return;
    
    socket.emit('send_message', {
        room: ROOM,
        username: chatCurrentUser.username,
        userId: chatCurrentUser.id,
        message: message
    });
    
    messageInput.value = '';
}

// Afficher un message
function displayMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.username === chatCurrentUser.username ? 'own' : 'other'}`;
    
    const time = new Date(data.timestamp).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        ${data.username !== chatCurrentUser.username ? `<div class="message-username">${data.username}</div>` : ''}
        <div class="message-text">${escapeHtml(data.message)}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Afficher un message système
function displaySystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.textContent = message;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Charger l'historique des messages
async function loadMessageHistory() {
    try {
        const response = await fetch(`/api/messages/${ROOM}`);
        const messages = await response.json();
        
        messages.forEach(msg => {
            if (msg.type === 'system') {
                displaySystemMessage(msg.message);
            } else {
                displayMessage(msg);
            }
        });
    } catch (error) {
        console.error('Erreur chargement historique:', error);
    }
}

// Échapper le HTML pour éviter les XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// === WebRTC - Appels Vidéo ===

// Initier un appel
async function initiateCall() {
    // Pour la démo, on suppose qu'il y a un autre utilisateur
    // Dans une vraie app, il faudrait une liste d'utilisateurs
    const otherUserId = prompt('ID Socket du destinataire (visible dans la console du navigateur):');
    
    if (!otherUserId) return;
    
    remotePeerId = otherUserId;
    await startCall();
}

async function startCall() {
    try {
        // Obtenir le flux local
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        localVideo.srcObject = localStream;
        
        // Créer la connexion peer
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Ajouter les tracks locaux
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Gérer les tracks distants
        peerConnection.ontrack = (event) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteVideo.srcObject = remoteStream;
            }
            remoteStream.addTrack(event.track);
        };
        
        // Gérer les ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remotePeerId,
                    candidate: event.candidate
                });
            }
        };
        
        // Créer et envoyer l'offre
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('call_offer', {
            to: remotePeerId,
            offer: offer,
            from: socket.id,
            fromUsername: chatCurrentUser.username
        });
        
        callContainer.style.display = 'block';
        callStatusSpan.textContent = 'Appel en cours...';
        isCallActive = true;
        
    } catch (error) {
        console.error('Erreur démarrage appel:', error);
        alert('Impossible d\'accéder à la caméra/micro');
    }
}

// Accepter un appel
async function acceptCall() {
    incomingCallContainer.style.display = 'none';
    
    try {
        // Obtenir le flux local
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        localVideo.srcObject = localStream;
        
        // Créer la connexion peer
        peerConnection = new RTCPeerConnection(iceServers);
        
        // Ajouter les tracks locaux
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Gérer les tracks distants
        peerConnection.ontrack = (event) => {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteVideo.srcObject = remoteStream;
            }
            remoteStream.addTrack(event.track);
        };
        
        // Gérer les ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice_candidate', {
                    to: remotePeerId,
                    candidate: event.candidate
                });
            }
        };
        
        // Définir l'offre distante et créer une réponse
        await peerConnection.setRemoteDescription(new RTCSessionDescription(window.pendingOffer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('call_answer', {
            to: remotePeerId,
            answer: answer
        });
        
        callContainer.style.display = 'block';
        callStatusSpan.textContent = 'Appel connecté';
        isCallActive = true;
        
    } catch (error) {
        console.error('Erreur acceptation appel:', error);
        alert('Impossible d\'accéder à la caméra/micro');
    }
}

// Refuser un appel
function rejectCall() {
    incomingCallContainer.style.display = 'none';
    socket.emit('end_call', { to: remotePeerId });
    remotePeerId = null;
}

// Terminer un appel
function endCallHandler() {
    socket.emit('end_call', { to: remotePeerId });
    endCall();
}

function endCall() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (remoteStream) {
        remoteStream = null;
    }
    
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    
    callContainer.style.display = 'none';
    incomingCallContainer.style.display = 'none';
    isCallActive = false;
    remotePeerId = null;
}

// Toggle audio
function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        toggleAudioBtn.textContent = audioTrack.enabled ? '🎤 Micro' : '🔇 Micro coupé';
    }
}

// Toggle vidéo
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        toggleVideoBtn.textContent = videoTrack.enabled ? '📹 Vidéo' : '📹 Vidéo coupée';
    }
}

// Exposer la fonction d'initialisation
window.initializeChat = initializeChat;
