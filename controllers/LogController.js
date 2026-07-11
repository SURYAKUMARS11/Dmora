const Log = require('../models/Log');
const { addLog } = require('../utils/logger');
const { processComment } = require('./WebhookController');

// GET: Fetch recent 200 logs for the authenticated user
exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(200);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Clear all logs for the authenticated user
exports.clearLogs = async (req, res) => {
  try {
    const userId = req.user.id;
    await Log.deleteMany({ userId });
    addLog(userId, 'info', 'Logs cleared by user');
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Manual webhook test comment trigger
exports.manualTestTrigger = async (req, res) => {
  try {
    const userId = req.user.id;
    const testComment = {
      comment_id: req.body.comment_id || 'test_comment_' + Math.random().toString(36).substr(2, 9),
      media_id: req.body.mediaId || req.body.media_id || 'test_media_1234567890',
      text: req.body.text || 'pdf',
      from: {
        username: req.body.username || 'test_user',
        id: req.body.userId || '1234567890'
      }
    };

    if (req.body.parent_id) {
      testComment.parent_id = req.body.parent_id;
    }

    addLog(userId, 'info', '--- Initiating Manual Test Trigger ---');
    
    // Process async, passing userId to override config query
    processComment(testComment, userId)
      .then(() => {
        addLog(userId, 'info', '--- Manual Test Trigger Completed ---');
      })
      .catch((err) => {
        addLog(userId, 'error', `Error running manual test trigger: ${err.message}`);
      });

    res.json({ success: true, message: 'Test trigger initiated. See logs panel for progress.' });
  } catch (error) {
    console.error('Error in manual test trigger:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
