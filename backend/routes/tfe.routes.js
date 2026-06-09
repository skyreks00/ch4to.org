const express = require('express');
const router = express.Router();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../utils/db');
const QRCode = require('qrcode');

router.get('/presenter', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/presenter.html'));
});

router.get('/jury', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/jury.html'));
});

// Route de connexion/inscription à la volée pour les membres du jury
router.post('/api/tfe/jury-login', async (req, res) => {
  try {
    let username = '';
    let isUnique = false;
    let attempts = 0;
    
    // Récupérer et assainir le nom soumis
    const rawName = req.body && req.body.name ? req.body.name : '';
    const baseName = rawName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
      .replace(/[^a-zA-Z0-9_-]/g, ""); // Ne garder que alphanum, tiret, underscore
      
    const desiredName = baseName || 'Jury';
    const isPresenter = desiredName.toLowerCase() === 'wilmus';
    
    // Vérifier si le nom existe déjà
    const existing = await prisma.user.findUnique({
      where: { username: desiredName }
    });
    
    if (!existing) {
      username = desiredName;
      isUnique = true;
    } else {
      if (isPresenter) {
        // Si c'est le présentateur Wilmus, on le connecte directement
        username = desiredName;
        isUnique = true;
      } else {
        // S'il existe déjà, ajouter un suffixe aléatoire de 3 chiffres
        while (!isUnique && attempts < 15) {
          const randomId = Math.floor(100 + Math.random() * 900); // 3 chiffres
          username = `${desiredName}_${randomId}`;
          
          const dup = await prisma.user.findUnique({
            where: { username }
          });
          if (!dup) {
            isUnique = true;
          }
          attempts++;
        }
      }
    }
    
    if (!isUnique) {
      return res.status(500).json({ error: 'Impossible de générer un compte jury unique.' });
    }
    
    let user;
    if (existing && isPresenter) {
      user = existing;
    } else {
      const email = `${username.toLowerCase()}@ch4to.org`;
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      // Créer le compte utilisateur dans le modèle relationnel
      user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword
        }
      });
    }
    
    // Définir la session Express
    req.session.userId = user.id;
    req.session.username = user.username;
    
    // Signer le Token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erreur session Jury TFE:', err);
        return res.status(500).json({ error: 'Erreur lors de la création de la session.' });
      }
      
      console.log(`👤 Compte jury créé et connecté à la volée : ${username}`);
      
      const tfeState = req.app.get('tfeState');
      if (tfeState && tfeState.juryUsernames) {
        tfeState.juryUsernames.add(user.username);
      }

      res.json({
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
    console.error('Erreur lors du login jury TFE:', error);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Route locale pour générer un QR code hors-ligne en PNG
router.get('/api/tfe/qrcode', async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) {
      return res.status(400).send('Data parameter is required');
    }
    
    res.setHeader('Content-Type', 'image/png');
    await QRCode.toFileStream(res, data, {
      margin: 2,
      width: 250
    });
  } catch (error) {
    console.error('Error generating local QR code:', error);
    res.status(500).send('Error generating QR code');
  }
});

module.exports = router;
