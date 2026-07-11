const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
});

// Index logs by timestamp desc for fast polling queries
LogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Log', LogSchema);
