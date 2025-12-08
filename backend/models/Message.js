/**
 * Modèle MongoDB pour les messages du chat.
 * Stocke le contenu, l'expéditeur, le type (texte/fichier) et les métadonnées.
 */
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  senderId: {
    type: Number,
    required: true
  },
  avatar: {
    type: String,
    default: null
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  fileUrl: {
    type: String,
    default: null
  },
  readBy: [{
    type: Number
  }],
  conversationId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Optimisation des recherches par conversation et par expéditeur
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });

// Alias pour compatibilité frontend (message = content)
messageSchema.virtual('message').get(function() {
  return this.content;
});

// S'assurer que les virtuels sont inclus dans JSON
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
