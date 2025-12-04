const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');

const router = express.Router();

// Middleware pour vérifier l'authentification (Session OU Token JWT)
const requireAuth = (req, res, next) => {
  // Vérifier d'abord la session (cookies)
  if (req.session.userId) {
    return next();
  }
  
  // Sinon, vérifier le token JWT dans l'header Authorization
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

// Créer un groupe
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

// Obtenir les groupes de l'utilisateur
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

// Ajouter un membre à un groupe
router.post('/:groupId/members', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const { userId } = req.body;
    
    // Vérifier que l'utilisateur est membre du groupe
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.session.userId
      }
    });
    
    if (!membership) {
      return res.status(403).json({ error: 'Vous n\'êtes pas membre de ce groupe' });
    }
    
    // Ajouter le nouveau membre
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

// Quitter un groupe
router.delete('/:groupId/leave', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    
    await prisma.groupMember.deleteMany({
      where: {
        groupId,
        userId: req.session.userId
      }
    });
    
    res.json({ message: 'Vous avez quitté le groupe' });
  } catch (error) {
    console.error('Erreur quitter groupe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
