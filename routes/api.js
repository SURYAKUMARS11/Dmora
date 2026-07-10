const express = require('express');
const router = express.Router();

const ConfigController = require('../controllers/ConfigController');
const CampaignController = require('../controllers/CampaignController');
const LogController = require('../controllers/LogController');
const WebhookController = require('../controllers/WebhookController');

// Configuration Routes
router.get('/config', ConfigController.getConfig);
router.post('/config', ConfigController.saveConfig);

// Campaign Rules Routes
router.get('/campaigns', CampaignController.getCampaigns);
router.post('/campaigns', CampaignController.saveCampaign);
router.delete('/campaigns/:id', CampaignController.deleteCampaign);

// Instagram Media Endpoint
router.get('/instagram/media', CampaignController.getInstagramMedia);

// Execution Logs Routes
router.get('/logs', LogController.getLogs);
router.post('/clear-logs', LogController.clearLogs);

// Webhook Manual Test Simulators
router.post('/test-trigger', LogController.manualTestTrigger);
router.post('/test-postback', WebhookController.manualPostbackTrigger);

module.exports = router;
