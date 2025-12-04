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

// Rechercher des utilisateurs
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { query } = req.query;
    console.log('🔍 Recherche d\'utilisateurs avec query:', query);
    
    if (!query || query.length < 2) {
      console.log('⚠️ Query trop courte ou vide');
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
        email: true
      },
      take: 10
    });
    
    console.log(`✅ ${users.length} utilisateurs trouvés`);
    res.json(users);
  } catch (error) {
    console.error('Erreur recherche utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoyer une demande d'ami
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
    
    // Vérifier si une demande existe déjà
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
    
    res.status(201).json(friendship);
  } catch (error) {
    console.error('Erreur envoi demande ami:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les demandes d'ami en attente
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
            email: true
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

// Accepter une demande d'ami
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
    
    res.json(updated);
  } catch (error) {
    console.error('Erreur acceptation demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Refuser/Supprimer une demande d'ami
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

// Obtenir la liste des amis
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
            email: true
          }
        },
        receiver: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });
    
    // Retourner les friendships complètes (pas juste les users)
    res.json(friendships);
  } catch (error) {
    console.error('Erreur récupération amis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
