const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../utils/db');

const router = express.Router();

// Configuration Multer pour l'upload d'images de groupe
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
    cb(null, 'group-avatar-' + uniqueSuffix + path.extname(file.originalname));
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

// Wrapper pour gérer les erreurs Multer
const uploadGroupAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Erreur upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
};

// Middleware d'authentification (Session ou Token)
const requireAuth = (req, res, next) => {
  if (!req.session) {
    console.error('❌ req.session est undefined !');
    return res.status(500).json({ error: 'Erreur configuration session' });
  }

  if (req.session.userId) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.session.userId = decoded.userId;
      req.session.username = decoded.username;
      return next();
    } catch (error) {
      console.error('❌ Token JWT invalide:', error.message);
    }
  }
  
  return res.status(401).json({ error: 'Non authentifié' });
};

// Création d'un groupe
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nom du groupe requis' });
    }
    
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        creatorId: req.session.userId,
        members: {
          create: [
            { userId: req.session.userId },
            ...(memberIds || []).map(id => ({ userId: id }))
          ]
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });
    
    res.status(201).json(group);
  } catch (error) {
    console.error('Erreur création groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des groupes de l'utilisateur
router.get('/list', requireAuth, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: req.session.userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        }
      }
    });
    
    res.json(groups);
  } catch (error) {
    console.error('Erreur récupération groupes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajout d'un membre au groupe
router.post('/:groupId/members', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId } = req.body;
    
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Groupe introuvable' });
    }

    if (group.creatorId !== req.session.userId) {
      return res.status(403).json({ error: 'Seul l\'administrateur peut ajouter des membres' });
    }
    
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Cet utilisateur est déjà membre du groupe' });
    }

    const newMember = await prisma.groupMember.create({
      data: {
        groupId,
        userId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        }
      }
    });
    
    res.status(201).json(newMember);
  } catch (error) {
    console.error('Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Suppression d'un membre (Admin uniquement)
router.delete('/:groupId/members/:userId', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const targetUserId = parseInt(req.params.userId);
    const requesterId = req.session.userId;

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      return res.status(404).json({ error: 'Groupe introuvable' });
    }

    if (group.creatorId !== requesterId) {
      return res.status(403).json({ error: 'Seul l\'administrateur peut supprimer des membres' });
    }

    if (targetUserId === requesterId) {
      return res.status(400).json({ error: 'Utilisez l\'option "Quitter le groupe" pour partir' });
    }

    await prisma.groupMember.deleteMany({
      where: {
        groupId,
        userId: targetUserId
      }
    });

    res.json({ message: 'Membre supprimé du groupe' });
  } catch (error) {
    console.error('Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Quitter un groupe
router.delete('/:groupId/leave', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.session.userId;
    const { newCreatorId } = req.body;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { 
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true
              }
            }
          }
        } 
      }
    });

    if (!group) {
      return res.status(404).json({ error: 'Groupe introuvable' });
    }

    // Gestion du départ du créateur
    if (group.creatorId === userId) {
      // Si dernier membre, suppression du groupe
      if (group.members.length === 1) {
        if (group.avatar && group.avatar.startsWith('/uploads/')) {
          const filename = path.basename(group.avatar);
          const avatarPath = path.join(__dirname, '../uploads', filename);
          if (fs.existsSync(avatarPath)) {
            try {
              fs.unlinkSync(avatarPath);
            } catch (err) {
              console.error('Erreur suppression avatar groupe:', err);
            }
          }
        }

        await prisma.group.delete({
          where: { id: groupId }
        });
        return res.json({ message: 'Groupe supprimé car vous étiez le dernier membre' });
      }

      // Sinon, transfert de propriété requis
      if (!newCreatorId) {
        return res.status(400).json({ 
          error: 'TRANSFER_REQUIRED', 
          message: 'Vous devez désigner un nouveau créateur avant de quitter le groupe',
          members: group.members.filter(m => m.userId !== userId)
        });
      }

      const isMember = group.members.some(m => m.userId === parseInt(newCreatorId));
      if (!isMember) {
        return res.status(400).json({ error: 'Le nouveau créateur doit être membre du groupe' });
      }

      await prisma.group.update({
        where: { id: groupId },
        data: { creatorId: parseInt(newCreatorId) }
      });
    }
    
    await prisma.groupMember.deleteMany({
      where: {
        groupId,
        userId: userId
      }
    });
    
    res.json({ message: 'Vous avez quitté le groupe' });
  } catch (error) {
    console.error('Erreur quitter groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'avatar de groupe
router.post('/:groupId/avatar', requireAuth, uploadGroupAvatar, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const userId = req.session.userId;
    
    if (isNaN(groupId)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'ID de groupe invalide' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoyé' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Groupe introuvable' });
    }

    if (group.creatorId !== userId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Seul le créateur du groupe peut changer l\'image' });
    }

    // Suppression de l'ancien avatar
    if (group.avatar && group.avatar.startsWith('/uploads/')) {
      const filename = path.basename(group.avatar);
      const oldAvatarPath = path.join(__dirname, '../uploads', filename);
      
      if (fs.existsSync(oldAvatarPath)) {
        try {
          fs.unlinkSync(oldAvatarPath);
        } catch (err) {
          console.error('⚠️ Erreur suppression ancien avatar groupe:', err);
        }
      }
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    
    await prisma.group.update({
      where: { id: groupId },
      data: { avatar: avatarUrl }
    });
    
    res.json({ success: true, avatar: avatarUrl });

  } catch (error) {
    console.error('❌ Erreur upload avatar groupe:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('❌ Erreur nettoyage fichier:', e);
      }
    }
    res.status(500).json({ error: `Erreur serveur: ${error.message}` });
  }
});

module.exports = router;
