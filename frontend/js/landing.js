document.addEventListener('DOMContentLoaded', async () => {
    const year = document.getElementById('current-year');
    if (year) {
        year.textContent = new Date().getFullYear();
    }

    try {
        const token = localStorage.getItem('authToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await fetch('/api/auth/check', {
            credentials: 'include',
            headers
        });

        const data = await response.json();
        if (data.authenticated) {
            const ctaLinks = document.querySelectorAll('a[href="index.html?view=login"], a[href="index.html?view=register"]');
            ctaLinks.forEach((link) => {
                link.href = 'index.html';
                if (link.textContent.includes('Connexion') || link.textContent.includes('Créer')) {
                    link.textContent = 'Ouvrir le chat';
                }
            });
        }
    } catch (error) {
        console.error('Vérification utilisateur impossible:', error);
    }
});
