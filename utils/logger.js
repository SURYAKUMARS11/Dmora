const Log = require('../models/Log');

/**
 * Adds an execution log entry to MongoDB and prints it to the console.
 * @param {string} userId - MongoDB User ID
 * @param {string} type - 'info', 'success', 'warning', 'error'
 * @param {string} message - Message text
 * @param {object} [details] - Optional JSON details object
 */
const addLog = async (userId, type, message, details = null) => {
  try {
    const newLog = new Log({
      userId,
      type,
      message,
      details
    });
    await newLog.save();
    console.log(`[${type.toUpperCase()}] [User: ${userId}] ${message}`);
  } catch (error) {
    console.error('Error adding log to MongoDB:', error.message);
  }
};

module.exports = { addLog };
