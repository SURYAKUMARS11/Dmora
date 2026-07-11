const Log = require('../models/Log');
const Campaign = require('../models/Campaign');

// GET: Retrieve overall 7-day trend and post-specific campaign analytics for user
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. Get overall 7-day daily activity trend
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const logs = await Log.find({
      userId,
      timestamp: { $gte: sevenDaysAgo },
      type: { $in: ['success', 'error'] }
    });

    // Initialize last 7 days object
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      dailyData[dateStr] = { date: dateStr, success: 0, error: 0 };
    }

    // Populate daily counts
    logs.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (dailyData[dateStr]) {
        if (log.type === 'success') dailyData[dateStr].success++;
        if (log.type === 'error') dailyData[dateStr].error++;
      }
    });

    const trend = Object.values(dailyData);

    // 2. Get post-specific automation analytics
    const campaigns = await Campaign.find({ userId })
      .select('name mediaId triggerCount successCount errorCount')
      .sort({ triggerCount: -1 });

    res.json({
      success: true,
      trend,
      campaigns
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
