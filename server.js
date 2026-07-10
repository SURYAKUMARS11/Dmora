const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

const connectDB = require('./config/db');
const Config = require('./models/Config');
const Campaign = require('./models/Campaign');
const Log = require('./models/Log');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (MERN production build or development fallback)
const distPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Connect to MongoDB
connectDB().then(() => {
  // Run JSON database migration after connection succeeds
  migrateJsonToMongo();
});

// Import Router files
const apiRouter = require('./routes/api');
const webhookRouter = require('./routes/webhook');

// Map Routes
app.use('/api', apiRouter);
app.use('/webhook', webhookRouter);

// Migration utility: config.json and logs.json to MongoDB
async function migrateJsonToMongo() {
  const CONFIG_PATH = path.join(__dirname, 'config.json');
  const LOGS_PATH = path.join(__dirname, 'logs.json');
  
  try {
    // 1. Migrate Configuration
    if (fs.existsSync(CONFIG_PATH)) {
      console.log('Found local config.json file, migrating to MongoDB...');
      const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      
      let mongoConfig = await Config.findOne({ accountId: 'default' });
      if (!mongoConfig) {
        mongoConfig = new Config({
          accountId: 'default',
          pageAccessToken: configData.pageAccessToken || '',
          verifyToken: configData.verifyToken || 'my_secure_verify_token_123',
          instagramUsername: configData.instagramUsername || '',
          keywords: configData.keywords || 'sent, pdf, link',
          publicReply: configData.publicReply || 'Sent ✅ Follow me and check your DM.',
          privateDM: configData.privateDM || 'Hey! Here is the content 👇\n\nhttps://example.com/your-pdf-link',
          isEnabled: configData.isEnabled !== undefined ? configData.isEnabled : true,
          ignoreReplies: configData.ignoreReplies !== undefined ? configData.ignoreReplies : true
        });
        await mongoConfig.save();
        console.log('Configuration successfully migrated to MongoDB.');
      }
      
      // 2. Migrate Campaign Rules
      if (configData.rules && Array.isArray(configData.rules)) {
        console.log(`Migrating ${configData.rules.length} campaign rules to MongoDB...`);
        for (const rule of configData.rules) {
          const campaignExists = await Campaign.findOne({ mediaId: rule.mediaId, accountId: 'default' });
          if (!campaignExists) {
            const newCampaign = new Campaign({
              name: rule.name,
              mediaId: rule.mediaId,
              keywords: rule.keywords || '',
              triggerOnAny: !!rule.triggerOnAny,
              publicReply: rule.publicReply,
              privateDM: rule.privateDM,
              requireFollow: !!rule.requireFollow,
              followFallbackDM: rule.followFallbackDM || '',
              isEnabled: rule.isEnabled !== undefined ? rule.isEnabled : true,
              accountId: 'default'
            });
            await newCampaign.save();
          }
        }
        console.log('Campaign rules successfully migrated.');
      }
      
      // Backup the config.json file
      fs.renameSync(CONFIG_PATH, CONFIG_PATH + '.backup');
      console.log('config.json backed up as config.json.backup');
    }
    
    // 3. Migrate Execution Logs
    if (fs.existsSync(LOGS_PATH)) {
      console.log('Found local logs.json file, migrating to MongoDB...');
      const logsData = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf8'));
      
      if (Array.isArray(logsData)) {
        const logCount = await Log.countDocuments({ accountId: 'default' });
        if (logCount === 0) {
          const logsToInsert = logsData.map(log => ({
            accountId: 'default',
            timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
            type: log.type,
            message: log.message,
            details: log.details
          }));
          
          if (logsToInsert.length > 0) {
            await Log.insertMany(logsToInsert);
            console.log(`Successfully migrated ${logsToInsert.length} logs to MongoDB.`);
          }
        }
      }
      
      // Backup the logs.json file
      fs.renameSync(LOGS_PATH, LOGS_PATH + '.backup');
      console.log('logs.json backed up as logs.json.backup');
    }
  } catch (error) {
    console.error('Error migrating JSON files to MongoDB:', error);
  }
}

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Instagram Auto-DM MERN Backend is running!`);
  console.log(`🔗 Local Address: http://localhost:${PORT}`);
  console.log(`==================================================`);
// Dev touch to trigger watch restart
});
