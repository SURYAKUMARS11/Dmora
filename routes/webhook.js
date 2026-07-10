const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/WebhookController');

// Webhook endpoints
router.get('/', WebhookController.verifyWebhook);
router.post('/', WebhookController.handleWebhookEvent);

module.exports = router;
