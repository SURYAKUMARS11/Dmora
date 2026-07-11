const Config = require('../models/Config');
const Campaign = require('../models/Campaign');
const { addLog } = require('../utils/logger');

// Webhook GET: Verification (Global Verify Token from environment variables)
exports.verifyWebhook = async (req, res) => {
  try {
    const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'my_secure_verify_token_123';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Meta] Webhook verified successfully!');
        return res.status(200).send(challenge);
      } else {
        console.warn(`[Meta] Webhook verification failed: Token mismatch (received: ${token})`);
        return res.sendStatus(403);
      }
    }
    res.sendStatus(400);
  } catch (error) {
    console.error('Error verifying webhook:', error);
    res.sendStatus(500);
  }
};

// Webhook POST: Event handler (Multi-tenant dispatcher)
exports.handleWebhookEvent = async (req, res) => {
  try {
    // Acknowledge receipt of webhook event immediately to Meta
    res.status(200).send('EVENT_RECEIVED');

    const body = req.body;

    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        const pageId = entry.id; // Facebook Page ID connected to the Instagram Business Account
        
        if (!pageId) {
          console.warn('Received Webhook without Page ID in entry:', entry);
          continue;
        }

        // Retrieve config and check if active for this pageId
        const config = await Config.findOne({ facebookPageId: pageId });
        if (!config || !config.isEnabled) {
          continue; // Account config not found or disabled
        }
        
        const userId = config.userId;

        addLog(userId, 'info', `Received webhook event for Page ${pageId}`, { 
          hasEntry: !!body.entry,
          entryCount: body.entry?.length || 0
        });

        // 1. Process messaging events (Postbacks, DMs)
        if (entry.messaging && Array.isArray(entry.messaging)) {
          for (const messageEvent of entry.messaging) {
            await handleMessagingEvent(messageEvent, null, pageId);
          }
        }
        
        // 2. Process changes (Comments)
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              const comment = change.value;
              if (!comment) continue;

              await exports.processComment(comment, null, pageId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
  }
};

// Process a comment event
exports.processComment = async (comment, overrideUserId = null, facebookPageId = null) => {
  try {
    let config;
    let userId;

    if (overrideUserId) {
      config = await Config.findOne({ userId: overrideUserId });
      userId = overrideUserId;
    } else if (facebookPageId) {
      config = await Config.findOne({ facebookPageId });
      userId = config ? config.userId : null;
    }

    if (!config || !config.isEnabled || !userId) return;

    const comment_id = comment.id || comment.comment_id || '';
    const media_id = (comment.media && comment.media.id) || comment.media_id;
    const { text, from } = comment;
    const username = from ? from.username : 'Unknown';
    const recipientId = from ? from.id : 'Unknown';
    
    addLog(userId, 'info', `New comment received on media ${media_id} from @${username}: "${text}"`);

    // 1. Check if the comment is from the page owner itself to prevent loops
    if (config.instagramUsername && username.toLowerCase().trim() === config.instagramUsername.toLowerCase().trim()) {
      addLog(userId, 'info', `Ignored comment from page owner (@${username}) to prevent self-looping.`);
      return;
    }

    // 2. Check if this is a reply to another comment (if ignoreReplies is enabled)
    if (config.ignoreReplies && (comment.parent_id || comment.parent_comment_id)) {
      addLog(userId, 'info', `Ignored sub-comment reply thread from @${username} on comment ${comment_id}`);
      return;
    }

    // 3. Search for post-specific rule
    const matchedRule = await Campaign.findOne({ mediaId: media_id, userId, isEnabled: true });
    
    let activeKeywords = config.keywords || '';
    let activePublicReply = config.publicReply || '';
    let activePrivateDM = config.privateDM || '';
    let triggerOnAny = false;
    let requireFollow = false;
    let followFallbackDM = '';
    let ruleName = 'Default Config Settings';

    if (matchedRule) {
      activeKeywords = matchedRule.keywords || '';
      activePublicReply = matchedRule.publicReply || '';
      activePrivateDM = matchedRule.privateDM || '';
      triggerOnAny = !!matchedRule.triggerOnAny;
      requireFollow = !!matchedRule.requireFollow;
      followFallbackDM = matchedRule.followFallbackDM || '';
      ruleName = `Campaign: "${matchedRule.name}"`;
      addLog(userId, 'info', `Found post-specific automation rule for media ${media_id}: "${matchedRule.name}"`);
    }

    // 4. Match keywords
    let matchedKeyword = 'ANY_COMMENT';
    if (!triggerOnAny) {
      const triggerKeywords = activeKeywords
        .split(',')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

      const commentTextLower = (text || '').toLowerCase();
      
      // Check if comment contains any trigger keyword
      const foundKeyword = triggerKeywords.find(kw => commentTextLower.includes(kw));

      if (!foundKeyword) {
        addLog(userId, 'info', `Comment from @${username} on media ${media_id} did not match any trigger keywords for ${ruleName}.`);
        return;
      }
      matchedKeyword = foundKeyword;
    }

    addLog(userId, 'success', `Trigger matched (type: ${triggerOnAny ? 'Any Comment' : `Keyword "${matchedKeyword}"`}) in comment "${text}" by @${username} (${ruleName})`);

    // Increment campaign-specific triggerCount
    if (matchedRule) {
      try {
        matchedRule.triggerCount = (matchedRule.triggerCount || 0) + 1;
        await matchedRule.save();
      } catch (err) {
        console.error('Error updating campaign triggerCount:', err);
      }
    }

    if (!config.pageAccessToken) {
      addLog(userId, 'error', 'Cannot process replies because Meta Page Access Token is not configured!');
      return;
    }

    // 5. Send Public Reply
    let publicReplySuccess = false;
    if (comment_id && !comment_id.startsWith('test_')) {
      publicReplySuccess = await publicReplyToComment(userId, comment_id, activePublicReply, config);
    } else {
      // Simulator reply mock logging
      addLog(userId, 'success', `[MOCK] Public Reply posted to @${username}'s comment: "${activePublicReply}"`);
      publicReplySuccess = true;
    }

    if (!publicReplySuccess) {
      addLog(userId, 'warning', `Skipping private DM routing because public comment reply failed delivery.`);
      return;
    }

    // 6. Check Follow Gate Status
    let isFollowing = true;
    if (requireFollow) {
      if (comment_id && comment_id.startsWith('test_')) {
        // Simulator checks: triggers follow fallback if comment contains "notfollowing"
        isFollowing = !text.toLowerCase().includes('notfollowing');
        addLog(userId, 'info', `[MOCK] Simulated follow-gate check: user is ${isFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`);
      } else {
        try {
          addLog(userId, 'info', `Checking follower status for user ${recipientId} (@${username})...`);
          const followRes = await fetch(`https://graph.facebook.com/v20.0/${recipientId}?fields=is_user_follow_business&access_token=${config.pageAccessToken}`);
          const followData = await followRes.json();
          if (followRes.ok) {
            isFollowing = !!followData.is_user_follow_business;
            addLog(userId, 'info', `Follower status checked: @${username} is ${isFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`);
          } else {
            addLog(userId, 'error', `Failed to check follow status: ${followData.error?.message || 'Unknown API error'}. Defaulting to true to send resource.`, followData.error);
            isFollowing = true;
          }
        } catch (error) {
          addLog(userId, 'error', `Error checking follow status: ${error.message}. Defaulting to true.`, { stack: error.stack });
          isFollowing = true;
        }
      }
    }

    // 7. Send Private DM Reply (Success or Fallback with Buttons)
    if (isFollowing) {
      const success = await sendResourceDM(userId, recipientId, matchedRule || config, config, comment_id, username);
      if (matchedRule) {
        if (success) {
          matchedRule.successCount = (matchedRule.successCount || 0) + 1;
        } else {
          matchedRule.errorCount = (matchedRule.errorCount || 0) + 1;
        }
        await matchedRule.save();
      }
    } else {
      if (matchedRule) {
        const success = await sendFollowGateDM(userId, recipientId, username, matchedRule, comment_id, config);
        if (success) {
          matchedRule.successCount = (matchedRule.successCount || 0) + 1;
        } else {
          matchedRule.errorCount = (matchedRule.errorCount || 0) + 1;
        }
        await matchedRule.save();
      } else {
        await sendDM(userId, recipientId, followFallbackDM, config, comment_id, username);
      }
    }
  } catch (error) {
    console.error('Error in processComment:', error);
  }
};

// Helper: Send either rich card DM or standard text DM depending on settings
async function sendResourceDM(userId, recipientId, ruleOrConfig, config, commentId = null, username = 'User') {
  try {
    if (ruleOrConfig && ruleOrConfig.useRichCard) {
      const title = ruleOrConfig.cardTitle || 'Your Resource is Ready! 🎉';
      const subtitle = ruleOrConfig.cardSubtitle || 'Click the button below to download.';
      const imageUrl = ruleOrConfig.cardImage || '';
      const buttonText = ruleOrConfig.cardButtonText || 'Download Now 📥';
      const buttonUrl = ruleOrConfig.cardButtonUrl || ruleOrConfig.privateDM || 'https://example.com';

      // Construct generic template payload
      const element = {
        title: title.substring(0, 80),
        subtitle: subtitle.substring(0, 80),
        buttons: [
          {
            type: "web_url",
            url: buttonUrl,
            title: buttonText.substring(0, 20)
          }
        ]
      };

      if (imageUrl) {
        element.image_url = imageUrl;
      }

      const payload = {
        recipient: commentId ? { comment_id: commentId } : { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [element]
            }
          }
        }
      };

      if (commentId && commentId.startsWith('test_')) {
        addLog(userId, 'success', `[MOCK] Rich Card DM sent successfully to @${username}! Title: "${title}", Subtitle: "${subtitle}", Image: "${imageUrl}", Button: "${buttonText}" -> "${buttonUrl}"`);
        return true;
      }

      const response = await fetch(`https://graph.facebook.com/v20.0/me/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.pageAccessToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        addLog(userId, 'success', `Rich Card DM sent successfully to @${username}!`, data);
        return true;
      } else {
        addLog(userId, 'error', `Failed to send Rich Card DM to @${username}: ${data.error?.message}. Falling back to plain text.`, data.error);
        // Fallback to text DM
        return await sendDM(userId, recipientId, ruleOrConfig.privateDM, config, commentId, username);
      }
    } else {
      // Send standard text DM
      return await sendDM(userId, recipientId, ruleOrConfig.privateDM, config, commentId, username);
    }
  } catch (error) {
    addLog(userId, 'error', `Exception occurred in sendResourceDM: ${error.message}`);
    return await sendDM(userId, recipientId, ruleOrConfig.privateDM, config, commentId, username);
  }
}

// Helper: Send standard text DM
async function sendDM(userId, recipientId, text, config, commentId = null, username = 'User') {
  try {
    const payload = {
      recipient: commentId ? { comment_id: commentId } : { id: recipientId },
      message: { text }
    };
    
    if (commentId && commentId.startsWith('test_')) {
      addLog(userId, 'success', `[MOCK] Private DM sent successfully to @${username}! content: "${text}"`);
      return true;
    }
    
    const response = await fetch(`https://graph.facebook.com/v20.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.pageAccessToken}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (response.ok) {
      addLog(userId, 'success', `Private DM sent successfully to @${username}!`, data);
      return true;
    } else {
      addLog(userId, 'error', `Failed to send private DM to @${username}: ${data.error?.message || 'Unknown error'}`, data.error);
      return false;
    }
  } catch (error) {
    addLog(userId, 'error', `Exception occurred while sending private DM to @${username}: ${error.message}`);
    return false;
  }
}

// Helper: Send Follow Gate generic template with buttons
async function sendFollowGateDM(userId, recipientId, username, rule, commentId, config) {
  try {
    const fallbackText = rule.followFallbackDM || 'Please follow my profile first to unlock this resource!';
    const pageUsername = config.instagramUsername || 'startwith.surya';
    
    const payload = {
      recipient: commentId ? { comment_id: commentId } : { id: recipientId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "Oops! You are not following.",
                subtitle: fallbackText.substring(0, 80),
                buttons: [
                  {
                    type: "web_url",
                    url: `https://instagram.com/${pageUsername}`,
                    title: "Visit Profile"
                  },
                  {
                    type: "postback",
                    title: "Try Again 🔄",
                    payload: `TRY_AGAIN_CHECK:${rule._id}:${commentId || ''}`
                  }
                ]
              }
            ]
          }
        }
      }
    };
    
    if (commentId && commentId.startsWith('test_')) {
      addLog(userId, 'success', `[MOCK] Send Follow Gate Template (Buttons: Visit Profile & Try Again)`, {
        isFollowGateMock: true,
        ruleId: rule._id,
        commentId: commentId,
        userId: recipientId,
        username: username
      });
      return true;
    }
    
    const response = await fetch(`https://graph.facebook.com/v20.0/me/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.pageAccessToken}`
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    if (response.ok) {
      addLog(userId, 'success', `Follow Gate buttons template sent to @${username}!`, data);
      return true;
    } else {
      addLog(userId, 'warning', `Failed to send generic template buttons: ${data.error?.message}. Falling back to plain text.`);
      return await sendDM(userId, recipientId, `${fallbackText} (Visit profile: instagram.com/${pageUsername})`, config, commentId, username);
    }
  } catch (error) {
    addLog(userId, 'error', `Exception occurred while sending Follow Gate buttons: ${error.message}`);
    return false;
  }
}

// Helper: Post a public reply to comment
async function publicReplyToComment(userId, commentId, text, config) {
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${commentId}/replies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.pageAccessToken}`
      },
      body: JSON.stringify({ message: text })
    });
    
    const data = await response.json();
    if (response.ok) {
      addLog(userId, 'success', `Successfully posted public reply to comment ${commentId}!`, data);
      return true;
    } else {
      addLog(userId, 'error', `Failed to post public comment reply: ${data.error?.message || 'Unknown API error'}`, data.error);
      return false;
    }
  } catch (error) {
    addLog(userId, 'error', `Exception occurred while posting public reply to comment: ${error.message}`);
    return false;
  }
}

// Handler: Messaging Events (DMs & Postback clicks)
async function handleMessagingEvent(event, overrideUserId = null, facebookPageId = null) {
  const senderId = event.sender?.id;
  const postback = event.postback;
  
  if (!senderId || !postback || !postback.payload) return;
  
  let config;
  let userId;

  if (overrideUserId) {
    config = await Config.findOne({ userId: overrideUserId });
    userId = overrideUserId;
  } else if (facebookPageId) {
    config = await Config.findOne({ facebookPageId });
    userId = config ? config.userId : null;
  }

  if (!config || !userId) return;

  addLog(userId, 'info', `Received DM postback event from user ${senderId} with payload: "${postback.payload}"`);
  
  if (postback.payload.startsWith('TRY_AGAIN_CHECK:')) {
    const parts = postback.payload.split(':');
    const ruleId = parts[1];
    const commentId = parts[2];
    
    const rule = await Campaign.findOne({ _id: ruleId, userId });
    if (!rule) {
      addLog(userId, 'error', `Could not process Try Again postback: Rule with ID ${ruleId} not found`);
      return;
    }
    
    let username = 'User';
    if (commentId && commentId.startsWith('test_')) {
      username = 'test_user';
    } else {
      try {
        const userRes = await fetch(`https://graph.facebook.com/v20.0/${senderId}?fields=username&access_token=${config.pageAccessToken}`);
        const userData = await userRes.json();
        if (userRes.ok) username = userData.username;
      } catch (e) {}
    }

    let isFollowing = true;
    if (commentId && commentId.startsWith('test_')) {
      isFollowing = true;
      addLog(userId, 'info', `[MOCK] Simulated follow-gate check for Try Again: User is now FOLLOWING.`);
    } else {
      try {
        addLog(userId, 'info', `Checking follow status again for user ${senderId} (@${username})...`);
        const followRes = await fetch(`https://graph.facebook.com/v20.0/${senderId}?fields=is_user_follow_business&access_token=${config.pageAccessToken}`);
        const followData = await followRes.json();
        if (followRes.ok) {
          isFollowing = !!followData.is_user_follow_business;
          addLog(userId, 'info', `Re-checked follow status for @${username}: ${isFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`);
        } else {
          addLog(userId, 'error', `Failed to check follow status on Try Again: ${followData.error?.message || 'Unknown API error'}`);
          isFollowing = false;
        }
      } catch (error) {
        addLog(userId, 'error', `Error checking follow status on Try Again: ${error.message}`);
        isFollowing = false;
      }
    }
    
    if (isFollowing) {
      addLog(userId, 'success', `Try Again check passed! Instagram user @${username} is now following. Sending success resource...`);
      const success = await sendResourceDM(userId, senderId, rule, config, null, username);
      if (success) {
        rule.successCount = (rule.successCount || 0) + 1;
      } else {
        rule.errorCount = (rule.errorCount || 0) + 1;
      }
      await rule.save();
    } else {
      addLog(userId, 'warning', `Try Again check failed: Instagram user @${username} is still NOT following.`);
      const success = await sendFollowGateDM(userId, senderId, username, rule, null, config);
      if (success) {
        rule.successCount = (rule.successCount || 0) + 1;
      } else {
        rule.errorCount = (rule.errorCount || 0) + 1;
      }
      await rule.save();
    }
  }
}

// API: Manual Postback Test Trigger (Simulate button click Try Again)
exports.manualPostbackTrigger = async (req, res) => {
  try {
    const userId = req.user.id;
    const config = await Config.findOne({ userId });
    const { ruleId, commentId, userId: testUserId, username } = req.body;
    
    const testPostback = {
      sender: { id: testUserId || '1234567890' },
      postback: {
        payload: `TRY_AGAIN_CHECK:${ruleId}:${commentId || 'test_comment_123'}`
      }
    };
    
    addLog(userId, 'info', '--- Initiating Manual Postback Test Trigger ---');
    
    // Pass userId directly to guide logger & lookup inside messaging handler
    handleMessagingEvent(testPostback, userId)
      .then(() => {
        addLog(userId, 'info', '--- Manual Postback Test Trigger Completed ---');
      })
      .catch((err) => {
        addLog(userId, 'error', `Error running manual postback: ${err.message}`);
      });
      
    res.json({ success: true, message: 'Postback trigger initiated.' });
  } catch (error) {
    console.error('Error in manual postback trigger:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
