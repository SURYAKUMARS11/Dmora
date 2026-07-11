const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  facebookPageId: {
    type: String,
    default: ''
  },
  instagramBusinessId: {
    type: String,
    default: ''
  },
  pageAccessToken: {
    type: String,
    default: ''
  },
  verifyToken: {
    type: String,
    default: 'my_secure_verify_token_123'
  },
  instagramUsername: {
    type: String,
    default: ''
  },
  keywords: {
    type: String,
    default: 'sent, pdf, link'
  },
  publicReply: {
    type: String,
    default: 'Sent ✅ Follow me and check your DM.'
  },
  privateDM: {
    type: String,
    default: 'Hey! Here is the content 👇\n\nhttps://example.com/your-pdf-link'
  },
  cardTitle: {
    type: String,
    default: 'Your Resource is Ready! 🎉'
  },
  cardSubtitle: {
    type: String,
    default: 'Click the button below to download.'
  },
  cardImage: {
    type: String,
    default: ''
  },
  cardButtonText: {
    type: String,
    default: 'Download Now 📥'
  },
  cardButtonUrl: {
    type: String,
    default: 'https://example.com/your-pdf-link'
  },
  useRichCard: {
    type: Boolean,
    default: false
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  ignoreReplies: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Config', ConfigSchema);
