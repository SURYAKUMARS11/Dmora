const Config = require('../models/Config');
const Campaign = require('../models/Campaign');
const { addLog } = require('../utils/logger');

// Webhook GET: Verification
exports.verifyWebhook = async (req, res) => {
  try {
    const config = await Config.findOne({ accountId: 'default' }) || new Config({ accountId: 'default' });
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
      if (mode === 'subscribe' && token === config.verifyToken) {
        addLog('success', 'Webhook verified successfully by Meta!');
        return res.status(200).send(challenge);
      } else {
        addLog('warning', 'Webhook verification failed: Token mismatch', {
          expected: config.verifyToken,
          received: token
        });
        return res.sendStatus(403);
      }
    }
    res.sendStatus(400);
  } catch (error) {
    console.error('Error verifying webhook:', error);
    res.sendStatus(500);
  }
};

// Webhook POST: Event handler
exports.handleWebhookEvent = async (req, res) => {
  try {
    const config = await Config.findOne({ accountId: 'default' });
    
    // Acknowledge receipt of webhook event immediately to Meta
    res.status(200).send('EVENT_RECEIVED');

    if (!config || !config.isEnabled) {
      return; // Automation is disabled
    }

    const body = req.body;

    // Log incoming webhook event structure for debugging
    addLog('info', `Received webhook event with object type: "${body.object}"`, { 
      hasEntry: !!body.entry,
      entryCount: body.entry?.length || 0,
      firstEntryKeys: body.entry?.[0] ? Object.keys(body.entry[0]) : []
    });

    if (body.object === 'instagram') {
      for (const entry of body.entry) {
        // 1. Process messaging events (Postbacks, DMs)
        if (entry.messaging && Array.isArray(entry.messaging)) {
          for (const messageEvent of entry.messaging) {
            await handleMessagingEvent(messageEvent, config);
          }
        }
        
        // 2. Process changes (Comments)
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              const comment = change.value;
              if (!comment) continue;

              await exports.processComment(comment);
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
exports.processComment = async (comment) => {
  try {
    const config = await Config.findOne({ accountId: 'default' });
    if (!config || !config.isEnabled) return;

    const comment_id = comment.id || comment.comment_id || '';
    const media_id = (comment.media && comment.media.id) || comment.media_id;
    const { text, from } = comment;
    const username = from ? from.username : 'Unknown';
    const userId = from ? from.id : 'Unknown';
    
    addLog('info', `New comment received on media ${media_id} from @${username}: "${text}"`);

    // 1. Check if the comment is from the page owner itself to prevent infinite loops
    if (config.instagramUsername && username.toLowerCase().trim() === config.instagramUsername.toLowerCase().trim()) {
      addLog('info', `Ignored comment from page owner (@${username}) to prevent self-looping.`);
      return;
    }

    // 2. Check if this is a reply to another comment (if ignoreReplies is enabled)
    if (config.ignoreReplies && comment.parent_id) {
      addLog('info', `Ignored sub-comment reply (parent_id: ${comment.parent_id}) to keep clean main thread comments only.`);
      return;
    }

    // 3. Find matching rule (post-specific or default)
    let activeKeywords = config.keywords || '';
    let activePublicReply = config.publicReply || '';
    let activePrivateDM = config.privateDM || '';
    let triggerOnAny = false;
    let requireFollow = false;
    let followFallbackDM = '';
    let ruleName = 'Default Rule';
    let matchedRule = null;

    matchedRule = await Campaign.findOne({ mediaId: media_id, accountId: 'default', isEnabled: true });
    
    if (matchedRule) {
      activeKeywords = matchedRule.keywords || '';
      activePublicReply = matchedRule.publicReply || '';
      activePrivateDM = matchedRule.privateDM || '';
      triggerOnAny = !!matchedRule.triggerOnAny;
      requireFollow = !!matchedRule.requireFollow;
      followFallbackDM = matchedRule.followFallbackDM || '';
      ruleName = `Campaign: "${matchedRule.name}"`;
      addLog('info', `Found post-specific automation rule for media ${media_id}: "${matchedRule.name}"`);
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
        addLog('info', `Comment from @${username} on media ${media_id} did not match any trigger keywords for ${ruleName}.`);
        return;
      }
      matchedKeyword = foundKeyword;
    }

    addLog('success', `Trigger matched (type: ${triggerOnAny ? 'Any Comment' : `Keyword "${matchedKeyword}"`}) in comment "${text}" by @${username} (${ruleName})`);

    if (!config.pageAccessToken) {
      addLog('error', 'Cannot process replies because Meta Page Access Token is not configured!');
      return;
    }

    // 5. Send Public Reply
    let publicReplySuccess = false;
    if (activePublicReply) {
      try {
        addLog('info', `Attempting to send public reply to comment ${comment_id}...`);
        
        if (comment_id.startsWith('test_')) {
          addLog('success', `[MOCK] Public reply sent successfully to @${username}! (Simulated response for test comment)`);
          publicReplySuccess = true;
        } else {
          const response = await fetch(`https://graph.facebook.com/v20.0/${comment_id}/replies`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.pageAccessToken}`
            },
            body: JSON.stringify({
              message: activePublicReply
            })
          });

          const responseData = await response.json();
          if (response.ok) {
            addLog('success', `Public reply sent successfully to @${username}!`, responseData);
            publicReplySuccess = true;
          } else {
            addLog('error', `Failed to send public reply: ${responseData.error?.message || 'Unknown error'}`, responseData.error);
          }
        }
      } catch (error) {
        addLog('error', `Exception occurred while sending public reply: ${error.message}`, { stack: error.stack });
      }
    }

    // 6. Check Follow Status (Follow Gate)
    let isFollowing = true;
    if (requireFollow) {
      if (comment_id.startsWith('test_')) {
        if (text.toLowerCase().includes('notfollowing') || text.toLowerCase().includes('not_following')) {
          isFollowing = false;
          addLog('info', `[MOCK] Simulated follow-gate check for test user: User is NOT following.`);
        } else {
          isFollowing = true;
          addLog('info', `[MOCK] Simulated follow-gate check for test user: User is following.`);
        }
      } else {
        try {
          addLog('info', `Checking if Instagram user ${userId} (@${username}) follows the business profile...`);
          const followRes = await fetch(`https://graph.facebook.com/v20.0/${userId}?fields=is_user_follow_business&access_token=${config.pageAccessToken}`);
          const followData = await followRes.json();
          
          if (followRes.ok) {
            isFollowing = !!followData.is_user_follow_business;
            addLog('info', `Follow status for @${username}: ${isFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`);
          } else {
            addLog('error', `Failed to check follow status: ${followData.error?.message || 'Unknown API error'}. Defaulting to true to send resource.`, followData.error);
            isFollowing = true;
          }
        } catch (error) {
          addLog('error', `Error checking follow status: ${error.message}. Defaulting to true.`, { stack: error.stack });
          isFollowing = true;
        }
      }
    }

    // 7. Send Private DM Reply (Success or Fallback with Buttons)
    if (isFollowing) {
      await sendResourceDM(userId, matchedRule || config, config, comment_id, username);
    } else {
      if (matchedRule) {
        await sendFollowGateDM(userId, username, matchedRule, comment_id, config);
      } else {
        await sendDM(userId, followFallbackDM, config, comment_id, username);
      }
    }
  } catch (error) {
    console.error('Error in processComment:', error);
  }
};


// Helper: Send either rich card DM or standard text DM depending on settings
async function sendResourceDM(recipientId, ruleOrConfig, config, commentId = null, username = 'User') {
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
        addLog('success', `[MOCK] Rich Card DM sent successfully to @${username}! Title: "${title}", Subtitle: "${subtitle}", Image: "${imageUrl}", Button: "${buttonText}" -> "${buttonUrl}"`);
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
        addLog('success', `Rich Card DM sent successfully to @${username}!`, data);
        return true;
      } else {
        addLog('error', `Failed to send Rich Card DM to @${username}: ${data.error?.message}. Falling back to plain text.`, data.error);
        // Fallback to text DM
        return await sendDM(recipientId, ruleOrConfig.privateDM, config, commentId, username);
      }
    } else {
      // Send standard text DM
      return await sendDM(recipientId, ruleOrConfig.privateDM, config, commentId, username);
    }
  } catch (error) {
    addLog('error', `Exception occurred in sendResourceDM: ${error.message}`);
    return await sendDM(recipientId, ruleOrConfig.privateDM, config, commentId, username);
  }
}

// Helper: Send standard text DM
async function sendDM(recipientId, text, config, commentId = null, username = 'User') {
  try {
    const payload = {
      recipient: commentId ? { comment_id: commentId } : { id: recipientId },
      message: { text }
    };
    
    if (commentId && commentId.startsWith('test_')) {
      addLog('success', `[MOCK] Private DM sent successfully to @${username}! content: "${text}"`);
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
      addLog('success', `Private DM sent successfully to @${username}!`, data);
      return true;
    } else {
      addLog('error', `Failed to send private DM to @${username}: ${data.error?.message || 'Unknown error'}`, data.error);
      return false;
    }
  } catch (error) {
    addLog('error', `Exception occurred while sending private DM to @${username}: ${error.message}`);
    return false;
  }
}

// Helper: Send Follow Gate generic template with buttons
async function sendFollowGateDM(recipientId, username, rule, commentId, config) {
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
      addLog('success', `[MOCK] Send Follow Gate Template (Buttons: Visit Profile & Try Again)`, {
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
      addLog('success', `Follow Gate buttons template sent to @${username}!`, data);
      return true;
    } else {
      addLog('warning', `Failed to send generic template buttons: ${data.error?.message}. Falling back to plain text.`);
      return await sendDM(recipientId, `${fallbackText} (Visit profile: instagram.com/${pageUsername})`, config, commentId, username);
    }
  } catch (error) {
    addLog('error', `Exception occurred while sending Follow Gate buttons: ${error.message}`);
    return false;
  }
}

// Handler: Messaging Events (DMs & Postback clicks)
async function handleMessagingEvent(event, config) {
  const senderId = event.sender?.id;
  const postback = event.postback;
  
  if (!senderId || !postback || !postback.payload) return;
  
  addLog('info', `Received DM postback event from user ${senderId} with payload: "${postback.payload}"`);
  
  if (postback.payload.startsWith('TRY_AGAIN_CHECK:')) {
    const parts = postback.payload.split(':');
    const ruleId = parts[1];
    const commentId = parts[2];
    
    const rule = await Campaign.findOne({ _id: ruleId, accountId: 'default' });
    if (!rule) {
      addLog('error', `Could not process Try Again postback: Rule with ID ${ruleId} not found`);
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
      addLog('info', `[MOCK] Simulated follow-gate check for Try Again: User is now FOLLOWING.`);
    } else {
      try {
        addLog('info', `Checking follow status again for user ${senderId} (@${username})...`);
        const followRes = await fetch(`https://graph.facebook.com/v20.0/${senderId}?fields=is_user_follow_business&access_token=${config.pageAccessToken}`);
        const followData = await followRes.json();
        if (followRes.ok) {
          isFollowing = !!followData.is_user_follow_business;
          addLog('info', `Re-checked follow status for @${username}: ${isFollowing ? 'FOLLOWING' : 'NOT FOLLOWING'}`);
        } else {
          addLog('error', `Failed to check follow status on Try Again: ${followData.error?.message || 'Unknown API error'}`);
          isFollowing = false;
        }
      } catch (error) {
        addLog('error', `Error checking follow status on Try Again: ${error.message}`);
        isFollowing = false;
      }
    }
    
    if (isFollowing) {
      addLog('success', `Try Again check passed! Instagram user @${username} is now following. Sending success resource...`);
      await sendResourceDM(senderId, rule, config, null, username);
    } else {
      addLog('warning', `Try Again check failed: Instagram user @${username} is still NOT following.`);
      await sendFollowGateDM(senderId, username, rule, null, config);
    }
  }
}

// API: Manual Postback Test Trigger (Simulate button click Try Again)
exports.manualPostbackTrigger = async (req, res) => {
  try {
    const config = await Config.findOne({ accountId: 'default' });
    const { ruleId, commentId, userId, username } = req.body;
    
    const testPostback = {
      sender: { id: userId || '1234567890' },
      postback: {
        payload: `TRY_AGAIN_CHECK:${ruleId}:${commentId || 'test_comment_123'}`
      }
    };
    
    addLog('info', '--- Initiating Manual Postback Test Trigger ---');
    
    handleMessagingEvent(testPostback, config)
      .then(() => {
        addLog('info', '--- Manual Postback Test Trigger Completed ---');
      })
      .catch((err) => {
        addLog('error', `Error running manual postback: ${err.message}`);
      });
      
    res.json({ success: true, message: 'Postback trigger initiated.' });
  } catch (error) {
    console.error('Error in manual postback trigger:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
