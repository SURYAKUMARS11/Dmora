const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

if (!fs.existsSync(CONFIG_PATH)) {
  console.error('config.json not found!');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const token = config.pageAccessToken;

if (!token) {
  console.error('No Page Access Token found in config.json!');
  process.exit(1);
}

async function checkToken() {
  console.log('Querying Meta API to inspect the Page Access Token...');
  
  try {
    // 1. Query /me to see which page this token belongs to
    const pageRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name,category&access_token=${token}`);
    const pageData = await pageRes.json();
    
    if (!pageRes.ok) {
      console.error('Error querying /me endpoint:', pageData);
      return;
    }
    
    console.log('\n--- Facebook Page Info ---');
    console.log(`Page Name: ${pageData.name}`);
    console.log(`Page ID: ${pageData.id}`);
    console.log(`Category: ${pageData.category}`);
    
    // 2. Query the linked Instagram Business Account
    const igRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=instagram_business_account{id,username,name}&access_token=${token}`);
    const igData = await igRes.json();
    
    if (!igRes.ok) {
      console.error('Error querying linked Instagram account:', igData);
      return;
    }
    
    console.log('\n--- Linked Instagram Account ---');
    if (igData.instagram_business_account) {
      console.log(`Instagram ID: ${igData.instagram_business_account.id}`);
      console.log(`Instagram Username: @${igData.instagram_business_account.username}`);
      console.log(`Instagram Name: ${igData.instagram_business_account.name}`);
    } else {
      console.log('❌ NO LINKED INSTAGRAM BUSINESS ACCOUNT FOUND FOR THIS PAGE!');
      console.log('Please make sure you have linked your Instagram Business/Creator account to this specific Facebook Page in your Facebook Page Settings.');
    }
    
  } catch (error) {
    console.error('An error occurred during fetch:', error.message);
  }
}

checkToken();
