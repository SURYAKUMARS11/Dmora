const Config = require('../models/Config');
const { addLog } = require('../utils/logger');

// Helper: Automatically subscribe the Facebook Page/App to webhook fields
const subscribePageToWebhook = async (pageAccessToken, instagramUsername) => {
  try {
    // 1. Get Page ID and Name
    const pageRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${pageAccessToken}`);
    const pageData = await pageRes.json();
    if (!pageRes.ok || !pageData.id) {
      addLog('error', `Failed to retrieve Page details for webhook subscription: ${pageData.error?.message || 'Unknown error'}`);
      return false;
    }
    
    const pageId = pageData.id;
    
    // 2. Subscribe app to page
    addLog('info', `Subscribing app to Facebook Page "${pageData.name}" (${pageId}) webhooks...`);
    const subRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: 'messages,messaging_postbacks,message_reads,messaging_referrals,feed',
        access_token: pageAccessToken
      })
    });
    
    const subData = await subRes.json();
    if (subRes.ok && subData.success) {
      addLog('success', `Successfully subscribed app to Page "${pageData.name}" webhooks!`);
      return true;
    } else {
      addLog('error', `Failed to subscribe app to Page webhooks: ${subData.error?.message || 'Unknown error'}`, subData.error);
      return false;
    }
  } catch (error) {
    addLog('error', `Exception during Page webhook subscription: ${error.message}`);
    return false;
  }
};

// GET: Retrieve configuration
exports.getConfig = async (req, res) => {
  try {
    let config = await Config.findOne({ accountId: 'default' });
    if (!config) {
      config = new Config({ accountId: 'default' });
      await config.save();
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Save configuration
exports.saveConfig = async (req, res) => {
  try {
    const currentConfig = await Config.findOne({ accountId: 'default' }) || new Config({ accountId: 'default' });
    
    const isNewToken = req.body.pageAccessToken !== undefined && req.body.pageAccessToken !== currentConfig.pageAccessToken;
    const hasToken = !!req.body.pageAccessToken || !!currentConfig.pageAccessToken;

    currentConfig.pageAccessToken = req.body.pageAccessToken !== undefined ? req.body.pageAccessToken : currentConfig.pageAccessToken;
    currentConfig.verifyToken = req.body.verifyToken || currentConfig.verifyToken;
    currentConfig.instagramUsername = req.body.instagramUsername !== undefined ? req.body.instagramUsername : currentConfig.instagramUsername;
    currentConfig.keywords = req.body.keywords !== undefined ? req.body.keywords : currentConfig.keywords;
    currentConfig.publicReply = req.body.publicReply !== undefined ? req.body.publicReply : currentConfig.publicReply;
    currentConfig.privateDM = req.body.privateDM !== undefined ? req.body.privateDM : currentConfig.privateDM;
    currentConfig.cardTitle = req.body.cardTitle !== undefined ? req.body.cardTitle : currentConfig.cardTitle;
    currentConfig.cardSubtitle = req.body.cardSubtitle !== undefined ? req.body.cardSubtitle : currentConfig.cardSubtitle;
    currentConfig.cardImage = req.body.cardImage !== undefined ? req.body.cardImage : currentConfig.cardImage;
    currentConfig.cardButtonText = req.body.cardButtonText !== undefined ? req.body.cardButtonText : currentConfig.cardButtonText;
    currentConfig.cardButtonUrl = req.body.cardButtonUrl !== undefined ? req.body.cardButtonUrl : currentConfig.cardButtonUrl;
    currentConfig.useRichCard = req.body.useRichCard !== undefined ? req.body.useRichCard : currentConfig.useRichCard;
    currentConfig.isEnabled = req.body.isEnabled !== undefined ? req.body.isEnabled : currentConfig.isEnabled;
    currentConfig.ignoreReplies = req.body.ignoreReplies !== undefined ? req.body.ignoreReplies : currentConfig.ignoreReplies;

    await currentConfig.save();
    addLog('info', 'Configuration updated successfully');
    
    // Automatically trigger page subscription if token is present
    if (hasToken) {
      // Run asynchronously so we don't block the config response
      subscribePageToWebhook(currentConfig.pageAccessToken, currentConfig.instagramUsername);
    }

    res.json({ success: true, config: currentConfig });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
