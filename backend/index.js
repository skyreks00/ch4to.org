require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { connectMongoDB, disconnectDatabases } = require('./utils/db');
const authRoutes = require('./routes/auth');
const friendsRoutes = require('./routes/friends');
const groupsRoutes = require('./routes/groups');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Accept all origins
    methods: ["GET", "POST"],
    credentials: true // Allow credentials for Socket.io too
  }
});

const PORT = process.env.PORT || 3000;

// Middleware CORS - doit être configuré pour accepter les credentials
app.use(cors({
  origin: true, // Accept all origins (or specify your Cloudflare domain)
  credentials: true // IMPORTANT: Allow credentials (cookies)
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 heures
    httpOnly: true,
    secure: true, // MUST be true for HTTPS (Cloudflare Tunnel uses HTTPS)
    sameSite: 'none' // MUST be 'none' for cross-origin cookies with HTTPS
  }
});

app.use(sessionMiddleware);

// Debug middleware - log toutes les requêtes API
app.use('/api', (req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Session: ${req.session?.userId || 'none'} - Cookie: ${req.headers.cookie ? 'present' : 'missing'}`);
  next();
});

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);

// Route pour récupérer les messages d'une conversation
app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    console.log('📥 Requête de messages pour:', req.params.conversationId);
    
    const { conversationId } = req.params;
    const messages = await Message.find({ conversationId })
      .sort({ timestamp: 1 })
      .limit(100);
    
    console.log(`✅ ${messages.length} messages trouvés pour ${conversationId}`);
    res.json(messages);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route par défaut - servir index.html pour toutes les routes non-API
app.get('*', (req, res) => {
  // Ne pas intercepter les routes API
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Partager la session avec Socket.io
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Gestion des connexions Socket.io
const activeUsers = new Map(); // socketId -> {userId, username}
const userSockets = new Map(); // userId -> socketId
const callPeers = new Map();

io.on('connection', (socket) => {
  console.log(`✅ Utilisateur connecté: ${socket.id}`);
  
  // Enregistrer l'utilisateur en ligne
  socket.on('user_online', (data) => {
    const { userId, username } = data;
    activeUsers.set(socket.id, { userId, username });
    userSockets.set(userId, socket.id);
    console.log(`👤 ${username} (${userId}) est en ligne`);
  });
  
  // Rejoindre une conversation
  socket.on('join_conversation', async (data) => {
    const { conversationId, conversationType } = data;
    socket.join(conversationId);
    console.log(`💬 Socket ${socket.id} a rejoint la conversation: ${conversationId}`);
  });
  
  // Quitter une conversation
  socket.on('leave_conversation', (data) => {
    const { conversationId } = data;
    socket.leave(conversationId);
  });
  
  // Recevoir un message
  socket.on('send_message', async (data) => {
    try {
      const { conversationId, conversationType, username, message, senderId } = data;
      
      // Créer l'objet message pour MongoDB
      const messageData = {
        conversationId,
        conversationType: conversationType || (conversationId.startsWith('private_') ? 'private' : 'group'),
        senderId: senderId || 0,
        username,
        content: message,
        timestamp: new Date()
      };
      
      // Sauvegarder dans MongoDB
      try {
        const newMessage = await Message.create(messageData);
        
        // Diffuser à tous les clients de la conversation
        io.to(conversationId).emit('receive_message', {
          id: newMessage._id,
          conversationId,
          senderId: messageData.senderId,
          username: messageData.username,
          message: messageData.content,
          content: messageData.content,
          timestamp: messageData.timestamp,
          createdAt: messageData.timestamp
        });
        
        console.log(`💬 Message de ${username} dans ${conversationId}: ${message}`);
      } catch (dbError) {
        console.error('Erreur MongoDB:', dbError);
        // Envoyer quand même le message même si MongoDB échoue
        io.to(conversationId).emit('receive_message', {
          id: Date.now().toString(),
          conversationId,
          senderId: messageData.senderId,
          username: messageData.username,
          message: message,
          content: message,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
    }
  });
  
  // WebRTC Signaling - Offre
  socket.on('call_offer', (data) => {
    const { to, offer, from, fromUsername } = data;
    console.log(`📞 Appel de ${fromUsername} vers userId ${to}`);
    
    // Trouver le socket du destinataire par userId
    const toSocketId = userSockets.get(to);
    if (toSocketId) {
      callPeers.set(socket.id, toSocketId);
      callPeers.set(toSocketId, socket.id);
      
      io.to(toSocketId).emit('incoming_call', {
        from: socket.id,
        fromUsername,
        offer
      });
    } else {
      console.log(`❌ Utilisateur ${to} non trouvé`);
    }
  });
  
  // WebRTC Signaling - Réponse
  socket.on('call_answer', (data) => {
    const { to, answer } = data;
    console.log(`📞 Réponse d'appel vers socketId ${to}`);
    
    io.to(to).emit('call_answered', {
      answer
    });
  });
  
  // WebRTC Signaling - ICE Candidate
  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    io.to(to).emit('ice_candidate', {
      candidate
    });
  });
  
  // Terminer un appel
  socket.on('end_call', (data) => {
    const { to } = data;
    console.log(`📴 Appel terminé`);
    
    io.to(to).emit('call_ended');
    
    callPeers.delete(socket.id);
    callPeers.delete(to);
  });
  
  // Déconnexion
  socket.on('disconnect', async () => {
    const userInfo = activeUsers.get(socket.id);
    
    if (userInfo) {
      const { userId, username } = userInfo;
      userSockets.delete(userId);
      activeUsers.delete(socket.id);
      console.log(`❌ ${username} déconnecté`);
    }
    
    // Nettoyer les appels en cours
    const callPeer = callPeers.get(socket.id);
    if (callPeer) {
      io.to(callPeer).emit('call_ended');
      callPeers.delete(callPeer);
      callPeers.delete(socket.id);
    }
    
    console.log(`❌ Utilisateur déconnecté: ${socket.id}`);
  });
});

// Démarrage du serveur
const startServer = async () => {
  try {
    // Connexion MongoDB (optionnelle pour le test)
    try {
      await connectMongoDB();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB non disponible - Les messages ne seront pas sauvegardés');
      console.warn('   Pour activer la persistance, installez MongoDB ou utilisez MongoDB Atlas');
    }
    
    // Démarrer le serveur
    server.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
      console.log(`📡 Socket.io prêt pour les connexions temps réel`);
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre
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
