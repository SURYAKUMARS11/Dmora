const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: ''
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'user'
  },
  // SaaS Subscription Fields
  tier: {
    type: String,
    enum: ['free', 'pro', 'admin'],
    default: 'free'
  },
  stripeCustomerId: {
    type: String,
    default: ''
  },
  subscriptionStatus: {
    type: String,
    default: 'inactive'
  },
  // Meta Auth Credentials
  facebookUserId: {
    type: String,
    default: ''
  },
  longLivedUserToken: {
    type: String,
    default: ''
  },
  facebookPageId: {
    type: String,
    default: ''
  },
  instagramBusinessId: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
