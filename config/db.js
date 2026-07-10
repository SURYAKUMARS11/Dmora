const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/autodm';
    console.log(`Connecting to MongoDB at: ${mongoURI}...`);
    
    const conn = await mongoose.connect(mongoURI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`==================================================`);
    console.error(`❌ DATABASE CONNECTION ERROR:`);
    console.error(`Could not connect to MongoDB: ${error.message}`);
    console.error(`Please ensure MongoDB is running locally, or configure MONGO_URI in your .env file!`);
    console.error(`==================================================`);
  }
};

module.exports = connectDB;
