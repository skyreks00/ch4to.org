const API_URL = '/api';

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

document.addEventListener('DOMContentLoaded', function() {
    let currentUser = null;
    
    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const errorMessage = document.getElementById('error-message');
    const logoutBtn = document.getElementById('logout-btn');
    const currentUserSpan = document.getElementById('current-user');
    const landing = document.getElementById('landing');
    const landingLoginBtn = document.getElementById('landing-login');
    const landingRegisterBtn = document.getElementById('landing-register');
    const requestedView = new URLSearchParams(window.location.search).get('view');

    function showLanding() {
        if (requestedView === 'login' || requestedView === 'register') {
            showAuthForm(requestedView);
            return;
        }

        window.location.href = 'landing.html';
    }

    function showAuthForm(type) {
        if (landing) {
            landing.style.display = 'none';
        }

        if (type === 'register') {
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('register-form').style.display = 'block';
        } else {
            document.getElementById('register-form').style.display = 'none';
            document.getElementById('login-form').style.display = 'block';
        }
        errorMessage.textContent = '';
    }

    if (landingLoginBtn) {
        landingLoginBtn.addEventListener('click', () => showAuthForm('login'));
    }
    if (landingRegisterBtn) {
        landingRegisterBtn.addEventListener('click', () => showAuthForm('register'));
    }

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('register');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthForm('login');
    });

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

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: getAuthHeaders()
            });
            
            localStorage.removeItem('authToken');
            console.log('✅ Token JWT supprimé');
            
            currentUser = null;
            authContainer.style.display = 'flex';
            chatContainer.style.display = 'none';
            showLanding();
            
            if (window.socket) {
                window.socket.disconnect();
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
        }
    });

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
            } else {
                showLanding();
            }
        } catch (error) {
            console.error('Erreur vérification auth:', error);
            showLanding();
        }
    }

    function showChatInterface() {
        authContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        currentUserSpan.textContent = currentUser.username;
        
        const avatarContainer = document.getElementById('current-user-avatar');
        const initials = currentUser.username.substring(0, 2).toUpperCase();
        
        const colors = ['#5865F2', '#FAA61A', '#3BA55C', '#ED4245', '#EB459E'];
        const colorIndex = currentUser.username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
        const avatarColor = colors[colorIndex];
        
        if (currentUser.avatar) {
            avatarContainer.innerHTML = `<img src="${currentUser.avatar}" alt="${initials}" onerror="this.onerror=null; this.parentNode.innerHTML='${initials}'">`;
        } else {
            avatarContainer.style.backgroundColor = avatarColor;
            avatarContainer.textContent = initials;
        }
        
        if (typeof initializeApp === 'function') {
            initializeApp(currentUser);
        }
    }

    function showError(message) {
        errorMessage.textContent = message;
        setTimeout(() => {
            errorMessage.textContent = '';
        }, 5000);
    }

    if (requestedView === 'login' || requestedView === 'register') {
        showAuthForm(requestedView);
    }

    checkAuth();

});
