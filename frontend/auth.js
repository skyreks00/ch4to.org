// Gestion de l'authentification

const API_URL = '/api';

// Fonction helper pour obtenir les headers avec le token JWT
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

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', function() {
    let currentUser = null;
    
    // Éléments du DOM
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const errorMessage = document.getElementById('error-message');
    const logoutBtn = document.getElementById('logout-btn');
    const currentUserSpan = document.getElementById('current-user');

// Afficher le formulaire d'inscription
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
    errorMessage.textContent = '';
});

// Afficher le formulaire de connexion
showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    errorMessage.textContent = '';
});

// Inscription
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        console.log('🔁 Réponse register:', data);

        if (response.ok && data.token) {
            localStorage.setItem('authToken', data.token);
            console.log('✅ Token JWT stocké (register):', data.token);
            currentUser = data.user;
            showChatInterface();
        } else {
            showError(data.error || 'Erreur lors de l\'inscription');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Impossible de se connecter au serveur');
    }
});

// Connexion
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        console.log('🔁 Réponse login:', data);

        if (response.ok && data.token) {
            localStorage.setItem('authToken', data.token);
            console.log('✅ Token JWT stocké (login):', data.token);
            currentUser = data.user;
            showChatInterface();
        } else {
            showError(data.error || 'Erreur lors de la connexion');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showError('Impossible de se connecter au serveur');
    }
});

// Déconnexion
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        
        // Supprimer le token JWT
        localStorage.removeItem('authToken');
        console.log('✅ Token JWT supprimé');
        
        currentUser = null;
        authContainer.style.display = 'flex';
        chatContainer.style.display = 'none';
        
        // Déconnecter Socket.io
        if (window.socket) {
            window.socket.disconnect();
        }
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
});

// Vérifier si l'utilisateur est déjà connecté
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/auth/check`, { 
            credentials: 'include',
            headers: getAuthHeaders()
        });
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            showChatInterface();
        }
    } catch (error) {
        console.error('Erreur vérification auth:', error);
    }
}

// Afficher l'interface de chat
function showChatInterface() {
    authContainer.style.display = 'none';
    chatContainer.style.display = 'block';
    currentUserSpan.textContent = currentUser.username;
    
    // Initialiser l'application (défini dans app.js)
    if (typeof initializeApp === 'function') {
        initializeApp(currentUser);
    }
}

// Afficher un message d'erreur
function showError(message) {
    errorMessage.textContent = message;
    setTimeout(() => {
        errorMessage.textContent = '';
    }, 5000);
}

// Vérifier l'authentification au chargement
checkAuth();

}); // Fin DOMContentLoaded
