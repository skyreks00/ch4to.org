
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

messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ senderId: 1 });

messageSchema.virtual('message').get(function() {
  return this.content;
});

messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Message', messageSchema);
