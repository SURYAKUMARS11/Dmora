const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  accountId: {
    type: String,
    default: 'default'
  },
  name: {
    type: String,
    required: true
  },
  mediaId: {
    type: String,
    required: true
  },
  keywords: {
    type: String,
    default: ''
  },
  triggerOnAny: {
    type: Boolean,
    default: false
  },
  publicReply: {
    type: String,
    required: true
  },
  privateDM: {
    type: String,
    required: true
  },
  cardTitle: {
    type: String,
    default: ''
  },
  cardSubtitle: {
    type: String,
    default: ''
  },
  cardImage: {
    type: String,
    default: ''
  },
  cardButtonText: {
    type: String,
    default: ''
  },
  cardButtonUrl: {
    type: String,
    default: ''
  },
  useRichCard: {
    type: Boolean,
    default: false
  },
  requireFollow: {
    type: Boolean,
    default: false
  },
  followFallbackDM: {
    type: String,
    default: ''
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  triggerCount: {
    type: Number,
    default: 0
  },
  successCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Create compound index for accountId + mediaId
CampaignSchema.index({ accountId: 1, mediaId: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
