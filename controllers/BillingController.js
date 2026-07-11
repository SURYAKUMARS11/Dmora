const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const { addLog } = require('../utils/logger');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkeyid123456';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mockkeysecret123456';
const RAZORPAY_PLAN_ID = process.env.RAZORPAY_PLAN_ID || 'plan_mockproplan123';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockwebhooksecret123';

// Initialize Razorpay client. If mock keys are in use, we skip error triggers.
let razorpay;
if (!RAZORPAY_KEY_ID.startsWith('rzp_test_mock')) {
  try {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET
    });
  } catch (err) {
    console.error('Failed to initialize Razorpay client:', err.message);
  }
}

// 1. Create a Razorpay Subscription
exports.createSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check if user is already pro
    if (user.tier === 'pro' && user.subscriptionStatus === 'active') {
      return res.status(400).json({ success: false, error: 'You already have an active Pro subscription' });
    }

    addLog(userId, 'info', `Initiating Razorpay subscription request for plan ${RAZORPAY_PLAN_ID}...`);

    let subscription;
    
    // Check if we are running in mock environment
    if (!razorpay || RAZORPAY_KEY_ID.startsWith('rzp_test_mock')) {
      // Mock Subscription Creation
      const mockSubId = 'sub_mock_' + Math.random().toString(36).substr(2, 9);
      subscription = {
        id: mockSubId,
        status: 'created',
        plan_id: RAZORPAY_PLAN_ID,
        isMock: true
      };
      
      addLog(userId, 'success', `[MOCK] Created mock Razorpay subscription: ${mockSubId}`);
    } else {
      // Real Razorpay Subscription API Call
      subscription = await razorpay.subscriptions.create({
        plan_id: RAZORPAY_PLAN_ID,
        customer_notify: 1,
        total_count: 12 // 12 billing cycles (1 year)
      });
      
      addLog(userId, 'success', `Created active Razorpay subscription: ${subscription.id}`);
    }

    res.json({
      success: true,
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
      keyId: RAZORPAY_KEY_ID, // Frontend needs this to load Razorpay checkout
      isMock: !!subscription.isMock
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create subscription' });
  }
};

// 2. Verify Razorpay Signature
exports.verifyPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, isMock } = req.body;

    if (isMock) {
      // Mock Payment Verification
      await User.findByIdAndUpdate(userId, {
        tier: 'pro',
        subscriptionStatus: 'active',
        stripeCustomerId: 'cust_mock_' + Math.random().toString(36).substr(2, 9) // using stripeCustomerId for reference
      });
      addLog(userId, 'success', `[MOCK] Verified subscription payment for ${razorpay_subscription_id}. User upgraded to PRO.`);
      return res.json({ success: true, message: 'Mock payment verified successfully' });
    }

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment parameters' });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(razorpay_payment_id + '|' + razorpay_subscription_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      addLog(userId, 'error', `Invalid payment signature for subscription: ${razorpay_subscription_id}`);
      return res.status(400).json({ success: false, error: 'Payment verification failed' });
    }

    // Upgrade user status in database
    await User.findByIdAndUpdate(userId, {
      tier: 'pro',
      subscriptionStatus: 'active',
      stripeCustomerId: razorpay_subscription_id
    });

    addLog(userId, 'success', `Subscription payment verified! upgraded user to PRO tier (Subscription: ${razorpay_subscription_id})`);
    res.json({ success: true, message: 'Subscription payment verified successfully!' });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 3. Webhook Listener
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    if (!signature) {
      return res.status(400).send('No signature');
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('[Razorpay] Webhook signature verification failed');
      return res.status(400).send('Invalid signature');
    }

    const event = body.event;
    const payload = body.payload;

    console.log(`[Razorpay] Received Webhook Event: ${event}`);

    if (event === 'subscription.charged') {
      const sub = payload.subscription.entity;
      const subId = sub.id;

      // Find user connected to this subscription ID
      const user = await User.findOne({ stripeCustomerId: subId });
      if (user) {
        user.subscriptionStatus = 'active';
        user.tier = 'pro';
        await user.save();
        addLog(user._id, 'success', `Razorpay subscription renewed successfully: ${subId}`);
      }
    } else if (event === 'subscription.cancelled' || event === 'subscription.halted') {
      const sub = payload.subscription.entity;
      const subId = sub.id;

      const user = await User.findOne({ stripeCustomerId: subId });
      if (user) {
        user.subscriptionStatus = 'inactive';
        user.tier = 'free';
        await user.save();
        addLog(user._id, 'warning', `Razorpay subscription ended/cancelled: ${subId}. Downgraded to FREE tier.`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Razorpay Webhook:', error);
    res.status(500).send('Webhook Processing Error');
  }
};
