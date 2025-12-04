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
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  conversationType: {
    type: String,
    enum: ['private', 'group'],
    required: true
  },
  conversationId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['text', 'system'],
    default: 'text'
  }
});

// Index pour améliorer les performances de recherche
messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });

// Propriété virtuelle pour la compatibilité
messageSchema.virtual('message').get(function() {
  return this.content;
});

// S'assurer que les virtuels sont inclus dans JSON
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
