const Campaign = require('../models/Campaign');
const Config = require('../models/Config');
const { addLog } = require('../utils/logger');

const MOCK_MEDIA = [
  {
    id: "18092504771363564",
    media_type: "VIDEO",
    media_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop",
    permalink: "https://instagram.com",
    caption: "🚀 FREE PDF GUIDE: How to build a SaaS in 2026. Comment 'PDF' below to get it sent to your DM instantly! 👇 #saas #developer #nocode",
    timestamp: new Date().toISOString(),
    like_count: 1420,
    comments_count: 89,
    plays: 24500,
    shares: 310
  },
  {
    id: "18082608749329613",
    media_type: "IMAGE",
    media_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop",
    permalink: "https://instagram.com",
    caption: "Stop wasting time on manual outreach. Here is how we automate our DMs to close high-ticket clients. Comment 'SENT' to get the secret blueprint! 💸",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    like_count: 945,
    comments_count: 42,
    plays: 0,
    shares: 115
  },
  {
    id: "17862633246642193",
    media_type: "VIDEO",
    media_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop",
    permalink: "https://instagram.com",
    caption: "The exact tech stack we used to grow to $10k MRR in 30 days. Comment 'LINK' for the Github repo. 💻🔥",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    like_count: 2180,
    comments_count: 156,
    plays: 41200,
    shares: 640
  },
  {
    id: "18055609384803920",
    media_type: "IMAGE",
    media_url: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=500&auto=format&fit=crop",
    permalink: "https://instagram.com",
    caption: "Behind the scenes of our new SaaS launching next week. Comment 'BETA' to get early access before everyone else! 🚀",
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    like_count: 670,
    comments_count: 29,
    plays: 0,
    shares: 48
  }
];

// GET: Retrieve all campaigns
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find({ accountId: 'default' });
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// POST: Save or Update Campaign
exports.saveCampaign = async (req, res) => {
  try {
    const { 
      id, name, mediaId, keywords, triggerOnAny, publicReply, privateDM, 
      requireFollow, followFallbackDM, isEnabled,
      cardTitle, cardSubtitle, cardImage, cardButtonText, cardButtonUrl, useRichCard
    } = req.body;
    
    if (!name || !mediaId || !publicReply || !privateDM) {
      return res.status(400).json({ success: false, error: 'Missing required campaign fields' });
    }

    if (!triggerOnAny && !keywords) {
      return res.status(400).json({ success: false, error: 'Keywords are required when Trigger on Any Comment is disabled' });
    }

    let campaign;
    if (id) {
      campaign = await Campaign.findOne({ _id: id, accountId: 'default' });
      if (campaign) {
        campaign.name = name;
        campaign.mediaId = mediaId;
        campaign.keywords = keywords || '';
        campaign.triggerOnAny = !!triggerOnAny;
        campaign.publicReply = publicReply;
        campaign.privateDM = privateDM;
        campaign.requireFollow = !!requireFollow;
        campaign.followFallbackDM = followFallbackDM || '';
        campaign.isEnabled = isEnabled !== undefined ? isEnabled : true;
        campaign.cardTitle = cardTitle || '';
        campaign.cardSubtitle = cardSubtitle || '';
        campaign.cardImage = cardImage || '';
        campaign.cardButtonText = cardButtonText || '';
        campaign.cardButtonUrl = cardButtonUrl || '';
        campaign.useRichCard = !!useRichCard;
        
        await campaign.save();
        addLog('info', `Campaign "${name}" updated`);
      } else {
        return res.status(404).json({ success: false, error: 'Campaign not found' });
      }
    } else {
      campaign = new Campaign({
        name,
        mediaId,
        keywords: keywords || '',
        triggerOnAny: !!triggerOnAny,
        publicReply,
        privateDM,
        requireFollow: !!requireFollow,
        followFallbackDM: followFallbackDM || '',
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        cardTitle: cardTitle || '',
        cardSubtitle: cardSubtitle || '',
        cardImage: cardImage || '',
        cardButtonText: cardButtonText || '',
        cardButtonUrl: cardButtonUrl || '',
        useRichCard: !!useRichCard,
        accountId: 'default'
      });
      
      await campaign.save();
      addLog('info', `New campaign "${name}" created`);
    }

    const campaignsList = await Campaign.find({ accountId: 'default' });
    res.json({ success: true, rules: campaignsList });
  } catch (error) {
    console.error('Error saving campaign:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// DELETE: Delete a campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Campaign.deleteOne({ _id: id, accountId: 'default' });
    
    if (result.deletedCount > 0) {
      addLog('info', `Campaign with ID ${id} deleted`);
      const campaignsList = await Campaign.find({ accountId: 'default' });
      res.json({ success: true, rules: campaignsList });
    } else {
      res.status(404).json({ success: false, error: 'Campaign not found' });
    }
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// GET: Retrieve Instagram Media (Live or Mock fallback)
exports.getInstagramMedia = async (req, res) => {
  try {
    const config = await Config.findOne({ accountId: 'default' });
    
    if (!config || !config.pageAccessToken) {
      return res.json({ success: true, isMock: true, data: MOCK_MEDIA });
    }
    
    // 1. Get Instagram Business Account ID
    const pageRes = await fetch(`https://graph.facebook.com/v20.0/me?fields=instagram_business_account&access_token=${config.pageAccessToken}`);
    const pageData = await pageRes.json();
    
    if (!pageRes.ok || !pageData.instagram_business_account) {
      console.warn('Could not fetch Instagram account ID, falling back to mock posts:', pageData);
      return res.json({ success: true, isMock: true, data: MOCK_MEDIA });
    }
    
    const igAccountId = pageData.instagram_business_account.id;
    
    // 2. Get Media list
    const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${igAccountId}/media?fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,caption,like_count,comments_count,play_count&limit=50&access_token=${config.pageAccessToken}`);
    const mediaData = await mediaRes.json();
    
    if (!mediaRes.ok) {
      console.warn('Could not fetch media list from Meta, falling back to mock posts:', mediaData);
      return res.json({ success: true, isMock: true, data: MOCK_MEDIA });
    }
    
    res.json({ success: true, isMock: false, data: mediaData.data || [] });
  } catch (error) {
    console.error('Error fetching real Instagram media, returning mock data:', error.message);
    res.json({ success: true, isMock: true, data: MOCK_MEDIA });
  }
};
