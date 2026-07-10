const Log = require('../models/Log');
const { addLog } = require('../utils/logger');
const { processComment } = require('./WebhookController');

// GET: Fetch recent 200 logs
exports.getLogs = async (req, res) => {
  try {
    const logs = await Log.find({ accountId: 'default' }).sort({ timestamp: -1 }).limit(200);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Clear all logs
exports.clearLogs = async (req, res) => {
  try {
    await Log.deleteMany({ accountId: 'default' });
    addLog('info', 'Logs cleared by user');
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Manual webhook test comment trigger
exports.manualTestTrigger = async (req, res) => {
  try {
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

    addLog('info', '--- Initiating Manual Test Trigger ---');
    
    // Process async
    processComment(testComment)
      .then(() => {
        addLog('info', '--- Manual Test Trigger Completed ---');
      })
      .catch((err) => {
        addLog('error', `Error running manual test trigger: ${err.message}`);
      });

    res.json({ success: true, message: 'Test trigger initiated. See logs panel for progress.' });
  } catch (error) {
    console.error('Error in manual test trigger:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
