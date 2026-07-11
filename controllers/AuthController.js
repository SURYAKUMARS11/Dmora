const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { addLog } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'my_jwt_super_secret_token_change_this';

// 1. Check if admin exists
exports.getAuthStatus = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    res.json({ exists: adminCount > 0 });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 2. Setup first admin account
exports.setupAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const adminExists = await User.countDocuments({ role: 'admin' });
    if (adminExists > 0) {
      return res.status(400).json({ success: false, error: 'Admin account has already been configured' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newAdmin = new User({
      email,
      password: hashedPassword,
      role: 'admin'
    });

    await newAdmin.save();
    addLog('success', `Admin account created successfully: ${email}`);

    // Generate JWT
    const token = jwt.sign({ id: newAdmin._id, role: newAdmin.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error setting up admin account:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 3. User Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      addLog('warning', `Failed login attempt: Account not found for ${email}`);
      return res.status(400).json({ success: false, error: 'Invalid login credentials' });
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      addLog('warning', `Failed login attempt: Incorrect password for ${email}`);
      return res.status(400).json({ success: false, error: 'Invalid login credentials' });
    }

    addLog('success', `Admin logged in successfully: ${email}`);

    // Generate JWT
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 4. JWT Verification Middleware
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
