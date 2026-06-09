
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
const tfeRoutes = require('./routes/tfe.routes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  }
});

app.use(sessionMiddleware);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api', (req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Session: ${req.session?.userId || 'none'}`);
  next();
});

app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  limits: { fileSize: 50 * 1024 * 1024 }
});

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

app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/', tfeRoutes);

app.get('/api/messages/:conversationId', async (req, res) => {
  try {
    console.log('📥 Requête de messages pour:', req.params.conversationId);
    
    const { conversationId } = req.params;
    
    const messages = await Message.find({ conversationId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    messages.reverse();
    
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const users = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, username: true, avatar: true }
    });
    
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

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route non trouvée' });
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

const activeUsers = new Map();
const userSockets = new Map();
const callPeers = new Map();

// TFE Presentation global volatile state
let tfeState = {
  currentSlide: 1,
  votes1: { A: 0, B: 0, C: 0 },
  votedUsers1: new Set(),
  votes2: { A: 0, B: 0, C: 0 },
  votedUsers2: new Set(),
  juryCount: 0,
  jurySockets: new Set(),
  juryUsernames: new Set()
};

app.set('tfeState', tfeState);
app.set('activeUsers', activeUsers);

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

io.on('connection', (socket) => {
  console.log(`✅ Utilisateur connecté: ${socket.id}`);
  
  socket.on('user_online', async (data) => {
    const { userId, username } = data;
    activeUsers.set(socket.id, { userId, username });
    userSockets.set(userId, socket.id);
    socket.join(userId.toString());
    console.log(`👤 ${username} (${userId}) est en ligne`);
    
    io.emit('user_status_change', { userId, status: 'online' });
    io.emit('update_online_users', Array.from(activeUsers.values()).map(u => u.username));

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

  socket.on('check_online_status', (userIds, callback) => {
    if (Array.isArray(userIds) && typeof callback === 'function') {
      const onlineIds = userIds.filter(id => userSockets.has(parseInt(id)));
      callback(onlineIds);
    }
  });
  
  socket.on('join_conversation', (data) => {
    socket.join(data.conversationId);
    console.log(`💬 Socket ${socket.id} a rejoint: ${data.conversationId}`);
  });
  
  socket.on('leave_conversation', (data) => {
    socket.leave(data.conversationId);
  });
  
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
        io.to(conversationId).emit('receive_message', {
          id: Date.now().toString(),
          ...messageData
        });
      }
    } catch (error) {
      console.error('Erreur envoi message:', error);
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.conversationId).emit('user_stop_typing', data);
  });

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

  // --- TFE Presentation Events ---
  socket.on('join_tfe_room', (data) => {
    socket.join('tfe_presentation');
    const role = (data && data.role) || 'jury';
    
    if (role === 'jury' && !tfeState.jurySockets.has(socket.id)) {
      tfeState.jurySockets.add(socket.id);
      tfeState.juryCount++;
      io.to('tfe_presentation').emit('update_jury_count', tfeState.juryCount);
      console.log(`👨‍🏫 TFE: Nouveau juré connecté. Total : ${tfeState.juryCount}`);
    }
    
    socket.emit('tfe_state_init', {
      currentSlide: tfeState.currentSlide,
      votes1: tfeState.votes1,
      votes2: tfeState.votes2,
      juryCount: tfeState.juryCount
    });
    socket.emit('update_online_users', Array.from(activeUsers.values()).map(u => u.username));
  });

  socket.on('send_reaction', (data) => {
    io.to('tfe_presentation').emit('broadcast_heart', data);
  });

  socket.on('jury_heart', () => {
    io.to('tfe_presentation').emit('broadcast_heart', { type: 'heart' });
  });

  socket.on('submit_question', (data) => {
    const text = typeof data === 'object' ? data.text : data;
    const senderName = (data && data.senderName) ? escapeHTML(data.senderName) : 'Juré Anonyme';
    const sanitizedMessage = escapeHTML(text);
    io.to('tfe_presentation').emit('broadcast_message', {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      senderName: senderName,
      text: sanitizedMessage,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('submit_bcrypt_hash', (data) => {
    if (data && data.salt && data.hash) {
      io.to('tfe_presentation').emit('broadcast_bcrypt_hash', {
        salt: escapeHTML(data.salt),
        hash: escapeHTML(data.hash),
        senderName: data.senderName ? escapeHTML(data.senderName) : 'Juré'
      });
    }
  });

  socket.on('jury_message', (message) => {
    const sanitizedMessage = escapeHTML(message);
    io.to('tfe_presentation').emit('broadcast_message', {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      senderName: 'Juré Anonyme',
      text: sanitizedMessage,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('submit_vote', (data) => {
    const { quizId, option } = data;
    const votes = quizId == 1 ? tfeState.votes1 : tfeState.votes2;
    const votedUsers = quizId == 1 ? tfeState.votedUsers1 : tfeState.votedUsers2;
    
    if (votes && votedUsers && !votedUsers.has(socket.id)) {
      if (votes[option] !== undefined) {
        votes[option]++;
        votedUsers.add(socket.id);
        io.to('tfe_presentation').emit('quiz_results', {
          quizId,
          votes
        });
        console.log(`🗳️ TFE: Vote enregistré sur Quiz ${quizId} pour option ${option}`);
      }
    }
  });

  socket.on('change_slide', (slideNumber) => {
    tfeState.currentSlide = slideNumber;
    io.to('tfe_presentation').emit('slide_changed', slideNumber);
  });

  socket.on('reset_quiz', (quizId) => {
    if (quizId == 1) {
      tfeState.votes1 = { A: 0, B: 0, C: 0 };
      tfeState.votedUsers1.clear();
      io.to('tfe_presentation').emit('quiz_reset', 1);
    } else if (quizId == 2) {
      tfeState.votes2 = { A: 0, B: 0, C: 0 };
      tfeState.votedUsers2.clear();
      io.to('tfe_presentation').emit('quiz_reset', 2);
    } else {
      tfeState.votes1 = { A: 0, B: 0, C: 0 };
      tfeState.votedUsers1.clear();
      tfeState.votes2 = { A: 0, B: 0, C: 0 };
      tfeState.votedUsers2.clear();
      io.to('tfe_presentation').emit('quiz_reset', 'all');
    }
    console.log(`🗳️ TFE: Quiz ${quizId || 'all'} réinitialisé.`);
  });

  socket.on('reset_tfe_session', () => {
    tfeState.votes1 = { A: 0, B: 0, C: 0 };
    tfeState.votedUsers1.clear();
    tfeState.votes2 = { A: 0, B: 0, C: 0 };
    tfeState.votedUsers2.clear();
    tfeState.currentSlide = 1;
    tfeState.jurySockets.clear();
    tfeState.juryCount = 0;
    if (tfeState.juryUsernames) {
      tfeState.juryUsernames.clear();
    }
    
    io.to('tfe_presentation').emit('session_reset');
    console.log(`🎮 TFE: Session réinitialisée (Reset Kahoot).`);
  });
  // --------------------------------

  socket.on('disconnect', async () => {
    if (tfeState.jurySockets.has(socket.id)) {
      tfeState.jurySockets.delete(socket.id);
      tfeState.juryCount = Math.max(0, tfeState.juryCount - 1);
      io.to('tfe_presentation').emit('update_jury_count', tfeState.juryCount);
      console.log(`❌ TFE: Un juré s'est déconnecté. Total : ${tfeState.juryCount}`);
    }

    const userInfo = activeUsers.get(socket.id);
    
    if (userInfo) {
      const { userId, username } = userInfo;
      userSockets.delete(userId);
      activeUsers.delete(socket.id);
      console.log(`❌ ${username} déconnecté`);
      
      io.emit('user_status_change', { userId, status: 'offline' });
      io.emit('update_online_users', Array.from(activeUsers.values()).map(u => u.username));
    }
    
    const callPeer = callPeers.get(socket.id);
    if (callPeer) {
      io.to(callPeer).emit('call_ended');
      callPeers.delete(callPeer);
      callPeers.delete(socket.id);
    }
  });
});

const cleanupOldFiles = () => {
  const uploadDir = path.join(__dirname, 'uploads/messages');
  const MAX_AGE = 3 * 24 * 60 * 60 * 1000; 
  
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

const ensureTestUser = async () => {
  try {
    const existing = await prisma.user.findUnique({
      where: { username: 'JuryTest' }
    });
    if (!existing) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'JuryTest',
          email: 'jury@ch4to.org',
          password: hashedPassword
        }
      });
      console.log('👤 Compte de test "JuryTest" créé avec succès');
    }

    const presenterExisting = await prisma.user.findUnique({
      where: { username: 'Wilmus' }
    });
    if (!presenterExisting) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password123', 10);
      await prisma.user.create({
        data: {
          username: 'Wilmus',
          email: 'wilmus@ch4to.org',
          password: hashedPassword
        }
      });
      console.log('👤 Compte Présentateur "Wilmus" créé avec succès');
    }
  } catch (err) {
    console.error('⚠️ Impossible de créer les comptes de test:', err.message);
  }
};

const startServer = async () => {
  try {
    try {
      await connectMongoDB();
    } catch (mongoError) {
      console.warn('⚠️ MongoDB non disponible - Persistance désactivée');
    }
    
    // Assure key accounts exist
    await ensureTestUser();
    
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
