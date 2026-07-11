const User = require('../models/User');
const Config = require('../models/Config');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { addLog } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'my_jwt_super_secret_token_change_this';
const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:3000/api/auth/facebook/callback';

// 1. User Registration (SaaS Sign-up)
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create User
    const newUser = new User({
      name: name || '',
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      tier: 'free',
      subscriptionStatus: 'inactive'
    });

    await newUser.save();

    // Initialize Default User Configuration
    const newConfig = new Config({
      userId: newUser._id
    });
    await newConfig.save();

    // Log success
    addLog(newUser._id, 'success', `User account registered: ${email}`);

    // Generate JWT
    const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 2. User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid login credentials' });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid login credentials' });
    }

    // Log success
    addLog(user._id, 'success', `User logged in successfully: ${email}`);

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 3. Get Facebook Login URL
exports.getFacebookLoginUrl = (req, res) => {
  const userId = req.user.id;
  // Sign a temporary short-lived token to verify user ID in state parameter on callback redirect
  const stateToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  
  const scopes = [
    'instagram_basic',
    'instagram_manage_messages',
    'pages_messaging',
    'pages_show_list',
    'pages_read_engagement'
  ].join(',');

  const oauthUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&state=${stateToken}&scope=${scopes}`;
  
  res.json({ success: true, url: oauthUrl });
};

// 4. Facebook Callback Redirect Handler
exports.facebookCallback = async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.redirect('/?oauth_error=missing_parameters');
  }

  try {
    // 1. Decode state to retrieve userId
    const decoded = jwt.verify(state, JWT_SECRET);
    const userId = decoded.id;

    // 2. Exchange code for short-lived token
    const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&client_secret=${META_APP_SECRET}&code=${code}`);
    const tokenData = await tokenRes.json();
    
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Exchange code error:', tokenData.error);
      return res.redirect('/?oauth_error=code_exchange_failed');
    }

    const shortLivedToken = tokenData.access_token;

    // 3. Exchange short-lived token for long-lived user token
    const longLivedRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`);
    const longLivedData = await longLivedRes.json();

    if (!longLivedRes.ok || !longLivedData.access_token) {
      console.error('Long-lived token error:', longLivedData.error);
      return res.redirect('/?oauth_error=token_upgrade_failed');
    }

    const longLivedUserToken = longLivedData.access_token;

    // 4. Get Facebook User ID
    const meRes = await fetch(`https://graph.facebook.com/v20.0/me?access_token=${longLivedUserToken}`);
    const meData = await meRes.json();
    const facebookUserId = meData.id;

    // 5. Update user credentials in DB
    await User.findByIdAndUpdate(userId, {
      facebookUserId,
      longLivedUserToken
    });

    addLog(userId, 'success', 'Successfully connected Facebook Account via OAuth!');

    // Redirect user back to the React app with a success trigger parameter
    res.redirect('/?oauth_success=true');
  } catch (error) {
    console.error('Error in Facebook OAuth Callback:', error);
    res.redirect('/?oauth_error=server_error');
  }
};

// 5. Retrieve connected Facebook Pages & Instagram Accounts
exports.getConnectedPages = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.longLivedUserToken) {
      return res.status(400).json({ success: false, error: 'Facebook account is not connected. Please login with Facebook.' });
    }

    // Fetch pages managed by the user
    const pageRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${user.longLivedUserToken}`);
    const pageData = await pageRes.json();

    if (!pageRes.ok) {
      console.error('Error fetching Facebook Pages:', pageData);
      return res.status(400).json({ success: false, error: 'Failed to fetch connected pages from Meta.' });
    }

    // Map and filter pages that have a connected Instagram Business Account
    const pages = (pageData.data || [])
      .filter(p => !!p.instagram_business_account)
      .map(p => ({
        pageId: p.id,
        pageName: p.name,
        pageAccessToken: p.access_token,
        instagramAccount: {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          name: p.instagram_business_account.name || p.instagram_business_account.username,
          profilePicture: p.instagram_business_account.profile_picture_url || ''
        }
      }));

    res.json({ success: true, pages });
  } catch (error) {
    console.error('Error fetching connected pages:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 6. Activate and subscribe a specific Instagram page
exports.activateInstagramPage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { pageId, pageAccessToken, instagramAccountId, instagramUsername } = req.body;

    if (!pageId || !pageAccessToken || !instagramAccountId || !instagramUsername) {
      return res.status(400).json({ success: false, error: 'Missing required activation parameters' });
    }

    // 1. Update user page mapping in User model
    await User.findByIdAndUpdate(userId, {
      facebookPageId: pageId,
      instagramBusinessId: instagramAccountId
    });

    // 2. Save page settings in Config model
    let config = await Config.findOne({ userId });
    if (!config) {
      config = new Config({ userId });
    }

    config.pageAccessToken = pageAccessToken;
    config.facebookPageId = pageId;
    config.instagramBusinessId = instagramAccountId;
    config.instagramUsername = instagramUsername;
    config.isEnabled = true;

    await config.save();

    // 3. Subscribe the app to the Facebook Page webhooks
    const subRes = await fetch(`https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pageAccessToken}`
      },
      body: JSON.stringify({
        subscribed_fields: 'messages,messaging_postbacks,message_reads,messaging_referrals,feed'
      })
    });

    const subData = await subRes.json();
    if (subRes.ok && subData.success) {
      addLog(userId, 'success', `Activated Instagram Account @${instagramUsername} and successfully subscribed to Meta webhooks!`);
      res.json({ success: true, message: `Account @${instagramUsername} activated successfully!`, config });
    } else {
      addLog(userId, 'error', `Activated @${instagramUsername} but failed to subscribe webhooks: ${subData.error?.message}`, subData.error);
      res.status(400).json({ success: false, error: `Account activated but webhook registration failed: ${subData.error?.message}` });
    }
  } catch (error) {
    console.error('Error activating Instagram page:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 7. JWT Verification Middleware
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1]; // Bearer <token>
  if (!token) {
    return res.status(401).json({ success: false, error: 'Malformed authorization token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authorization token' });
  }
};
