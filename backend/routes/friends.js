const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');

const router = express.Router();

// Middleware d'authentification (Session ou Token)
const requireAuth = (req, res, next) => {
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

// Recherche d'utilisateurs
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query } },
              { email: { contains: query } }
            ]
          },
          { id: { not: req.session.userId } }
        ]
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true
      },
      take: 10
    });
    
    res.json(users);
  } catch (error) {
    console.error('Erreur recherche utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoi d'une demande d'ami
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.session.userId;
    
    if (!receiverId) {
      return res.status(400).json({ error: 'ID du destinataire requis' });
    }
    
    if (receiverId === senderId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous ajouter vous-même' });
    }
    
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId }
        ]
      }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Une demande existe déjà' });
    }
    
    const friendship = await prisma.friendship.create({
      data: {
        senderId,
        receiverId,
        status: 'pending'
      }
    });

    if (req.io) {
      req.io.to(receiverId.toString()).emit('new_friend_request', {
        sender: {
          id: senderId,
          username: req.session.username
        }
      });
    }
    
    res.status(201).json(friendship);
  } catch (error) {
    console.error('Erreur envoi demande ami:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des demandes en attente
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: {
        receiverId: req.session.userId,
        status: 'pending'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true
          }
        }
      }
    });
    
    res.json(requests);
  } catch (error) {
    console.error('Erreur récupération demandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Accepter une demande
router.post('/accept/:id', requireAuth, async (req, res) => {
  try {
    const friendshipId = parseInt(req.params.id);
    
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });
    
    if (!friendship || friendship.receiverId !== req.session.userId) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    
    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'accepted' }
    });

    if (req.io) {
      req.io.to(friendship.senderId.toString()).emit('friend_request_accepted', {
        user: {
          id: req.session.userId,
          username: req.session.username
        }
      });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Erreur acceptation demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Refuser ou supprimer une demande
router.delete('/request/:id', requireAuth, async (req, res) => {
  try {
    const friendshipId = parseInt(req.params.id);
    
    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId }
    });
    
    if (!friendship) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    
    if (friendship.senderId !== req.session.userId && 
        friendship.receiverId !== req.session.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }
    
    await prisma.friendship.delete({
      where: { id: friendshipId }
    });
    
    res.json({ message: 'Demande supprimée' });
  } catch (error) {
    console.error('Erreur suppression demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des amis
router.get('/list', requireAuth, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: req.session.userId },
          { receiverId: req.session.userId }
        ],
        status: 'accepted'
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true
          }
        }
      }
    });
    
    res.json(friendships);
  } catch (error) {
    console.error('Erreur récupération amis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un ami
router.delete('/:friendId', requireAuth, async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);
    const userId = req.session.userId;

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId }
        ]
      }
    });

    if (req.io) {
      req.io.to(friendId.toString()).emit('friend_removed', {
        userId: userId
      });
    }

    res.json({ message: 'Ami supprimé' });
  } catch (error) {
    console.error('Erreur suppression ami:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
