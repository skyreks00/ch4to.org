/**
 * Point d'entrée principal du serveur Backend.
 * Configure Express, Socket.io, la base de données et les routes API.
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const { connectMongoDB, disconnectDatabases, prisma } = require('./utils/db');
const authRoutes = require('./routes/auth');
const friendsRoutes = require('./routes/friends');
const groupsRoutes = require('./routes/groups');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Configuration Socket.io avec support CORS
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

// Middleware CORS pour accepter les requêtes cross-origin
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gestion des sessions utilisateurs (cookies sécurisés pour HTTPS)
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24h
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  }
});

app.use(sessionMiddleware);

// Rend l'instance Socket.io accessible dans les routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Log des requêtes API pour le débogage
app.use('/api', (req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Session: ${req.session?.userId || 'none'}`);
  next();
});

// Servir les fichiers statiques (Frontend et Uploads)
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration du stockage des fichiers uploadés
const messageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads/messages');
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'msg-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const messageUpload = multer({ 
  storage: messageStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Endpoint pour l'upload de fichiers dans le chat
app.post('/api/messages/upload', messageUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier' });
  }
  const fileUrl = `/uploads/messages/${req.file.filename}`;
  res.json({ 
    url: fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// Routes API principales
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);

// Récupère l'historique des messages et enrichit avec les infos utilisateurs à jour
app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    console.log('📥 Requête de messages pour:', req.params.conversationId);
    
    const { conversationId } = req.params;
    
    // Récupération depuis MongoDB
    const messages = await Message.find({ conversationId })
      .sort({ timestamp: 1 })
      .limit(100)
      .lean();
    
    // Récupération des infos utilisateurs depuis MySQL (Prisma)
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const users = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, username: true, avatar: true }
    });
    
    // Création d'une map pour enrichir rapidement les messages
    const userMap = {};
    users.forEach(user => { userMap[user.id] = user; });
    
    const enrichedMessages = messages.map(msg => {
      const user = userMap[msg.senderId];
      if (user) {
        return { ...msg, username: user.username, avatar: user.avatar };
      }
      return msg;
    });
    
    console.log(`✅ ${enrichedMessages.length} messages trouvés pour ${conversationId}`);
    res.json(enrichedMessages);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route Fallback : Sert l'application Frontend pour toute autre URL
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Partage de la session Express avec Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Gestion du temps réel (Socket.io)
const activeUsers = new Map();
const userSockets = new Map();
const callPeers = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Utilisateur connecté: ${socket.id}`);
  
  // Gestion du statut en ligne et reconnexion aux salles
  socket.on('user_online', async (data) => {
    const { userId, username } = data;
    activeUsers.set(socket.id, { userId, username });
    userSockets.set(userId, socket.id);
    socket.join(userId.toString());
    console.log(`👤 ${username} (${userId}) est en ligne`);
    
    io.emit('user_status_change', { userId, status: 'online' });

    // Reconnexion automatique aux salles (Amis et Groupes)
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
          status: 'accepted'
        }
      });

      friendships.forEach(f => {
        const otherId = f.senderId === userId ? f.receiverId : f.senderId;
        const conversationId = `private_${Math.min(userId, otherId)}_${Math.max(userId, otherId)}`;
        socket.join(conversationId);
      });

      const userGroups = await prisma.groupMember.findMany({
        where: { userId: userId },
        select: { groupId: true }
      });

      userGroups.forEach(g => {
        socket.join(`group_${g.groupId}`);
      });

    } catch (error) {
      console.error('Erreur auto-join rooms:', error);
    }
  });

  // Vérification des utilisateurs en ligne
  socket.on('check_online_status', (userIds, callback) => {
    if (Array.isArray(userIds) && typeof callback === 'function') {
      const onlineIds = userIds.filter(id => userSockets.has(parseInt(id)));
      callback(onlineIds);
    }
  });
  
  // Gestion des salles de conversation
  socket.on('join_conversation', (data) => {
    socket.join(data.conversationId);
    console.log(`💬 Socket ${socket.id} a rejoint: ${data.conversationId}`);
  });
  
  socket.on('leave_conversation', (data) => {
    socket.leave(data.conversationId);
  });
  
  // Réception et diffusion d'un message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, conversationType, username, message, senderId, avatar, type, fileUrl } = data;
      
      const messageData = {
        conversationId,
        conversationType: conversationType || (conversationId.startsWith('private_') ? 'private' : 'group'),
        senderId: senderId || 0,
        username,
        avatar,
        content: message || '',
        type: type || 'text',
        fileUrl: fileUrl || null,
        timestamp: new Date(),
        readBy: [senderId]
      };
      
      // Sauvegarde MongoDB et diffusion
      try {
        const newMessage = await Message.create(messageData);
        
        io.to(conversationId).emit('receive_message', {
          id: newMessage._id,
          ...messageData,
          createdAt: messageData.timestamp
        });
        
        console.log(`💬 Message (${messageData.type}) de ${username} dans ${conversationId}`);

      } catch (dbError) {
        console.error('Erreur MongoDB:', dbError);
        // Mode dégradé si BDD HS
        io.to(conversationId).emit('receive_message', {
          id: Date.now().toString(),
          ...messageData
        });
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
    }
  });

  // Indicateurs de frappe
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.conversationId).emit('user_stop_typing', data);
  });

  // Gestion des accusés de lecture
  socket.on('mark_read', async (data) => {
    const { conversationId, userId } = data;
    try {
      await Message.updateMany(
        { conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      socket.to(conversationId).emit('messages_read', { conversationId, userId });
    } catch (error) {
      console.error('Erreur mark_read:', error);
    }
  });
  
  // WebRTC - Signalisation pour les appels
  socket.on('call_offer', (data) => {
    const { to, offer, fromUsername } = data;
    console.log(`📞 Appel de ${fromUsername} vers userId ${to}`);
    
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      callPeers.set(socket.id, toSocketId);
      callPeers.set(toSocketId, socket.id);
      
      io.to(toSocketId).emit('incoming_call', {
        from: socket.id,
        fromUsername,
        offer
      });
    }
  });
  
  socket.on('call_answer', (data) => {
    io.to(data.to).emit('call_answered', { answer: data.answer });
  });
  
  socket.on('ice_candidate', (data) => {
    io.to(data.to).emit('ice_candidate', { candidate: data.candidate });
  });
  
  socket.on('end_call', (data) => {
    io.to(data.to).emit('call_ended');
    callPeers.delete(socket.id);
    callPeers.delete(data.to);
  });
  
  // Gestion de la déconnexion
  socket.on('disconnect', async () => {
    const userInfo = activeUsers.get(socket.id);
    
    if (userInfo) {
      const { userId, username } = userInfo;
      userSockets.delete(userId);
      activeUsers.delete(socket.id);
      console.log(`❌ ${username} déconnecté`);
      
      io.emit('user_status_change', { userId, status: 'offline' });
    }
    
    const callPeer = callPeers.get(socket.id);
    if (callPeer) {
      io.to(callPeer).emit('call_ended');
      callPeers.delete(callPeer);
      callPeers.delete(socket.id);
    }
  });
});

// Tâche planifiée : Suppression des fichiers > 3 jours
const cleanupOldFiles = () => {
  const uploadDir = path.join(__dirname, 'uploads/messages');
  const MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 jours
  
  if (!fs.existsSync(uploadDir)) return;

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('❌ Erreur lecture dossier uploads:', err);
      return;
    }

    const now = Date.now();
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;

        if (now - stats.mtime.getTime() > MAX_AGE) {
          fs.unlink(filePath, (err) => {
            if (err) console.error(`❌ Erreur suppression ${file}:`, err);
            else {
              deletedCount++;
              console.log(`🗑️ Fichier supprimé (expiration): ${file}`);
            }
          });
        }
      });
    });
  });
};

// Initialisation et démarrage du serveur
const startServer = async () => {
  try {
    // Connexion aux bases de données
    try {
      await connectMongoDB();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB non disponible - Persistance désactivée');
    }
    
    // Lancement du nettoyage automatique (immédiat + toutes les 24h)
    cleanupOldFiles();
    setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);
    
    server.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`📡 Socket.io prêt`);
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre (SIGINT/SIGTERM)
process.on('SIGINT', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await disconnectDatabases();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Arrêt du serveur...');
  await disconnectDatabases();
  process.exit(0);
});

startServer();
