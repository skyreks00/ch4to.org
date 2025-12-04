const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');

const router = express.Router();

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword
      }
    });

    // Créer la session ET un token JWT
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Créer le token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Sauvegarder la session avant de répondre
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      console.log('✅ Inscription réussie pour:', username, '- Session ID:', req.sessionID);
      res.status(201).json({
        message: 'Inscription réussie',
        token, // Envoyer le token au client
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Tentative de connexion:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
      console.log('❌ Username ou password manquant');
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      console.log('❌ Utilisateur non trouvé:', username);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('❌ Mot de passe incorrect pour:', username);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Mettre à jour la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Créer la session ET un token JWT
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Créer le token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Sauvegarder la session avant de répondre (important pour Cloudflare)
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      console.log('✅ Connexion réussie pour:', username, '- Session ID:', req.sessionID);
      res.json({
        message: 'Connexion réussie',
        token, // Envoyer le token au client
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Déconnexion
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ message: 'Déconnexion réussie' });
  });
});

// Vérifier la session
router.get('/check', (req, res) => {
  // Vérifier d'abord la session (cookies)
  if (req.session.userId) {
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  }
  
  // Sinon, vérifier le token JWT dans l'header Authorization
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return res.json({
        authenticated: true,
        user: {
          id: decoded.userId,
          username: decoded.username
        }
      });
    } catch (error) {
      console.error('❌ Token JWT invalide:', error.message);
    }
  }
  
  res.json({ authenticated: false });
});

module.exports = router;
