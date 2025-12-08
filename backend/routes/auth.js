/**
 * Routes d'authentification.
 * Gère l'inscription, la connexion, la déconnexion et la gestion du profil (avatar).
 */
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../utils/db');

const router = express.Router();

// Configuration Multer pour l'upload d'avatars
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Seules les images sont autorisées !'));
  }
});

// Inscription d'un nouvel utilisateur
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérification unicité
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword
      }
    });

    // Initialisation session et token
    req.session.userId = user.id;
    req.session.username = user.username;
    
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.session.save((err) => {
      if (err) {
        console.error('❌ Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      console.log('✅ Inscription réussie pour:', username);
      res.status(201).json({
        message: 'Inscription réussie',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
        }
      });
    });
  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion utilisateur
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Tentative de connexion:', req.body.username);
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Initialisation session et token
    req.session.userId = user.id;
    req.session.username = user.username;
    
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.session.save((err) => {
      if (err) {
        console.error('❌ Erreur sauvegarde session:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      
      console.log('✅ Connexion réussie pour:', username);
      res.json({
        message: 'Connexion réussie',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: user.avatar
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

// Vérification de l'état de connexion (Session ou Token)
router.get('/check', async (req, res) => {
  let userId = req.session.userId;

  if (!userId) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (error) {
        console.error('❌ Token JWT invalide:', error.message);
      }
    }
  }

  if (userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, avatar: true }
      });

      if (user) {
        return res.json({
          authenticated: true,
          user
        });
      }
    } catch (error) {
      console.error('Erreur récupération user:', error);
    }
  }
  
  res.json({ authenticated: false });
});

// Mise à jour de l'avatar (URL)
router.post('/avatar', async (req, res) => {
  try {
    let userId = req.session.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.userId;
        } catch (err) {}
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { avatarUrl } = req.body;
    
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    });

    res.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    console.error('Erreur mise à jour avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Wrapper pour gérer les erreurs Multer
const uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Erreur upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Upload d'avatar (Fichier)
router.post('/avatar/upload', uploadAvatar, async (req, res) => {
  try {
    let userId = req.session.userId;
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          userId = decoded.userId;
        } catch (err) {}
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    userId = parseInt(userId);

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }

    // Suppression de l'ancien avatar si existant
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { avatar: true }
      });

      if (currentUser && currentUser.avatar && currentUser.avatar.startsWith('/uploads/')) {
        const filename = path.basename(currentUser.avatar);
        const oldAvatarPath = path.join(__dirname, '../uploads', filename);
        
        if (fs.existsSync(oldAvatarPath)) {
          try {
            fs.unlinkSync(oldAvatarPath);
          } catch (err) {
            console.error('❌ Erreur suppression fichier:', err);
          }
        }
      }
    } catch (deleteErr) {
      console.error('Erreur lors de la tentative de suppression:', deleteErr);
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    
    await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl }
    });

    res.json({ success: true, avatar: avatarUrl });
  } catch (error) {
    console.error('Erreur upload avatar:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
