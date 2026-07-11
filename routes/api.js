const express = require('express');
const router = express.Router();

const ConfigController = require('../controllers/ConfigController');
const CampaignController = require('../controllers/CampaignController');
const LogController = require('../controllers/LogController');
const WebhookController = require('../controllers/WebhookController');
const AuthController = require('../controllers/AuthController');
const AnalyticsController = require('../controllers/AnalyticsController');
const BillingController = require('../controllers/BillingController');
const { checkCampaignLimit } = require('../middlewares/tierGate');

// Public Authentication & Billing Webhook Routes
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);
router.get('/auth/facebook/callback', AuthController.facebookCallback);
router.post('/billing/webhook', BillingController.handleWebhook);
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// Protected Dashboard API Routes (Requires JWT verifyToken)
router.use(AuthController.verifyToken);

// User Profile endpoint
router.get('/user/profile', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Facebook OAuth Operations
router.get('/auth/facebook', AuthController.getFacebookLoginUrl);
router.get('/auth/facebook/pages', AuthController.getConnectedPages);
router.post('/auth/facebook/activate', AuthController.activateInstagramPage);

// Billing Operations
router.post('/billing/subscribe', BillingController.createSubscription);
router.post('/billing/verify', BillingController.verifyPayment);

// Configuration Routes
router.get('/config', ConfigController.getConfig);
router.post('/config', ConfigController.saveConfig);

// Campaign Rules Routes
router.get('/campaigns', CampaignController.getCampaigns);
router.post('/campaigns', checkCampaignLimit, CampaignController.saveCampaign);
router.delete('/campaigns/:id', CampaignController.deleteCampaign);

// Instagram Media Endpoint
router.get('/instagram/media', CampaignController.getInstagramMedia);

// Analytics Routes
router.get('/analytics', AnalyticsController.getAnalytics);

// Execution Logs Routes
router.get('/logs', LogController.getLogs);
router.post('/clear-logs', LogController.clearLogs);

// Webhook Manual Test Simulators
router.post('/test-trigger', LogController.manualTestTrigger);
router.post('/test-postback', WebhookController.manualPostbackTrigger);

module.exports = router;
