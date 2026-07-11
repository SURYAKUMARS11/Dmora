const Campaign = require('../models/Campaign');
const User = require('../models/User');

exports.checkCampaignLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    // If admin role or pro subscription, bypass limits
    if (!user || user.role === 'admin' || user.tier === 'pro') {
      return next();
    }

    // Free users: limit campaigns to 1
    const campaignCount = await Campaign.countDocuments({ userId });

    // If saving a new campaign (req.body.id is not provided/empty)
    if (!req.body.id && campaignCount >= 1) {
      return res.status(403).json({
        success: false,
        error: 'Your Free Plan is limited to 1 active Campaign. Upgrade to PRO to automate unlimited posts!'
      });
    }

    next();
  } catch (error) {
    console.error('Tier Gate Error:', error);
    res.status(500).json({ success: false, error: 'Server validation error' });
  }
};
