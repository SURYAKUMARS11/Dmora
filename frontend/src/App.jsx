import { useState, useEffect } from 'react';

function App() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState('dashboard-tab');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [showPassword, setShowPassword] = useState(false);
  const [setupStep, setSetupStep] = useState(1);

  // Global Config & Campaigns & Logs Data State
  const [config, setConfig] = useState({
    pageAccessToken: '',
    verifyToken: 'my_secure_verify_token_123',
    instagramUsername: '',
    keywords: 'sent, pdf, link',
    publicReply: 'Sent ✅ Follow me and check your DM.',
    privateDM: 'Hey! Here is the content 👇\n\nhttps://example.com/your-pdf-link',
    cardTitle: 'Your Resource is Ready! 🎉',
    cardSubtitle: 'Click the button below to download.',
    cardImage: '',
    cardButtonText: 'Download Now 📥',
    cardButtonUrl: '',
    useRichCard: false,
    isEnabled: true,
    ignoreReplies: true
  });
  const [campaigns, setCampaigns] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [isMediaMock, setIsMediaMock] = useState(false);
  const [logs, setLogs] = useState([]);
  const [expandedLogs, setExpandedLogs] = useState({});

  // Simulator Form State
  const [simUsername, setSimUsername] = useState('john_doe');
  const [simComment, setSimComment] = useState('Please send me the pdf!');
  const [simMediaId, setSimMediaId] = useState('');
  const [simIsReply, setSimIsReply] = useState(false);

  // Modal State
  const [activeModalPost, setActiveModalPost] = useState(null); // Post object currently editing
  const [modalForm, setModalForm] = useState({
    id: '',
    name: '',
    mediaId: '',
    triggerOnAny: false,
    keywords: 'pdf',
    publicReply: 'Sent! Check your DM 📬',
    privateDM: 'Hey! Here is the link you requested: ',
    cardTitle: 'Your Resource is Ready! 🎉',
    cardSubtitle: 'Click the button below to download.',
    cardImage: '',
    cardButtonText: 'Download Now 📥',
    cardButtonUrl: '',
    useRichCard: false,
    requireFollow: false,
    followFallbackDM: 'Hey! Thanks for commenting. Please follow my profile first, then comment again to unlock your resource!',
    isEnabled: true
  });

  // Toast Helper
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Fetch Config
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  // Fetch Campaigns
  const loadCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (e) {
      console.error('Error loading campaigns:', e);
    }
  };

  // Fetch Instagram Media
  const loadMedia = async () => {
    setIsMediaLoading(true);
    try {
      const res = await fetch('/api/instagram/media');
      if (res.ok) {
        const result = await res.json();
        setMediaList(result.data || []);
        setIsMediaMock(!!result.isMock);
      }
    } catch (e) {
      console.error('Error loading media:', e);
      showToast('Error fetching posts. Showing fallback mock.', 'error');
    } finally {
      setIsMediaLoading(false);
    }
  };

  // Fetch Logs
  const loadLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Error loading logs:', e);
    }
  };

  // Run on mount
  useEffect(() => {
    loadConfig();
    loadCampaigns();
    loadMedia();
    loadLogs();

    // Poll logs every 2 seconds
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Handle Master Toggle Status
  const handleMasterToggle = async (e) => {
    const isChecked = e.target.checked;
    setConfig(prev => ({ ...prev, isEnabled: isChecked }));
    
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: isChecked })
      });
      if (res.ok) {
        showToast(`Instagram Bot Status updated: ${isChecked ? 'ACTIVE' : 'DISABLED'}`, 'info');
      }
    } catch (err) {
      showToast('Could not save master switch', 'error');
    }
  };

  // Save Settings Config
  const handleSaveConfigSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        showToast('Settings configuration saved successfully!', 'success');
        loadConfig();
      } else {
        showToast('Failed to save configuration settings', 'error');
      }
    } catch (err) {
      showToast('Error saving settings config', 'error');
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/clear-logs', { method: 'POST' });
      if (res.ok) {
        setLogs([]);
        showToast('Activity logs cleared!', 'info');
      }
    } catch (e) {
      showToast('Error clearing logs', 'error');
    }
  };

  // Run Test Simulation
  const handleRunSimulationSubmit = async (e) => {
    e.preventDefault();
    try {
      showToast('Firing simulated comment webhook...', 'info');
      const res = await fetch('/api/test-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: simUsername,
          text: simComment,
          mediaId: simMediaId,
          parent_id: simIsReply ? 'parent_comment_123' : undefined
        })
      });
      
      if (res.ok) {
        setTimeout(loadLogs, 600);
      } else {
        showToast('Simulation failed to trigger', 'error');
      }
    } catch (err) {
      showToast('Error firing simulation', 'error');
    }
  };

  // Simulate Postback Click (Try Again)
  const triggerMockPostback = async (ruleId, commentId, userId, username) => {
    try {
      showToast('Simulating "Try Again" button click...', 'info');
      const response = await fetch('/api/test-postback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, commentId, userId, username })
      });
      
      if (response.ok) {
        setTimeout(loadLogs, 600);
      } else {
        showToast('Failed to trigger postback simulation', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Error sending postback simulation', 'error');
    }
  };

  // Open Automation Modal
  const openModal = (post) => {
    setActiveModalPost(post);
    const existingRule = campaigns.find(c => c.mediaId === post.id);

    if (existingRule) {
      // Edit Existing Campaign
      setModalForm({
        id: existingRule._id || existingRule.id,
        name: existingRule.name,
        mediaId: post.id,
        triggerOnAny: !!existingRule.triggerOnAny,
        keywords: existingRule.keywords || '',
        publicReply: existingRule.publicReply,
        privateDM: existingRule.privateDM,
        cardTitle: existingRule.cardTitle || '',
        cardSubtitle: existingRule.cardSubtitle || '',
        cardImage: existingRule.cardImage || '',
        cardButtonText: existingRule.cardButtonText || '',
        cardButtonUrl: existingRule.cardButtonUrl || '',
        useRichCard: !!existingRule.useRichCard,
        requireFollow: !!existingRule.requireFollow,
        followFallbackDM: existingRule.followFallbackDM || '',
        isEnabled: existingRule.isEnabled !== undefined ? existingRule.isEnabled : true
      });
    } else {
      // Create New Campaign
      const cleanName = post.caption 
        ? post.caption.split('\n')[0].substring(0, 30).trim() + '...' 
        : `Post ${post.id.substring(0, 6)} Automation`;

      setModalForm({
        id: '',
        name: cleanName,
        mediaId: post.id,
        triggerOnAny: false,
        keywords: 'pdf',
        publicReply: 'Sent! Check your DM 📬',
        privateDM: 'Hey! Here is the link you requested: ',
        cardTitle: 'Your Resource is Ready! 🎉',
        cardSubtitle: 'Click the button below to download.',
        cardImage: '',
        cardButtonText: 'Download Now 📥',
        cardButtonUrl: '',
        useRichCard: false,
        requireFollow: false,
        followFallbackDM: 'Hey! Thanks for commenting. Please follow my profile first, then comment again to unlock your resource!',
        isEnabled: true
      });
    }
  };

  // Close Modal
  const closeModal = () => {
    setActiveModalPost(null);
  };

  // Save Modal Campaign Form
  const handleSaveCampaignSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modalForm)
      });
      
      const result = await res.json();
      if (res.ok && result.success) {
        showToast(`Automation rule saved for post successfully!`, 'success');
        setCampaigns(result.rules || []);
        closeModal();
      } else {
        showToast(result.error || 'Failed to save rules', 'error');
      }
    } catch (err) {
      showToast('Error saving campaign', 'error');
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete automation rules for this post?')) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showToast('Automation deleted successfully', 'info');
        setCampaigns(result.rules || []);
        closeModal();
      } else {
        showToast(result.error || 'Failed to delete automation', 'error');
      }
    } catch (err) {
      showToast('Error deleting campaign', 'error');
    }
  };

  // Get correct media image source (prefers thumbnail_url for videos/reels to prevent EADDR/onError failure)
  const getMediaSrc = (post) => {
    if (!post) return '';
    if (post.media_type === 'VIDEO' && post.thumbnail_url) {
      return post.thumbnail_url;
    }
    return post.media_url || post.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop';
  };

  // Helper Stats Calculation
  const totalTriggersCount = logs.filter(l => l.type === 'success').length;
  const errorTriggersCount = logs.filter(l => l.type === 'error').length;
  const successRate = totalTriggersCount > 0 
    ? Math.round((totalTriggersCount / (totalTriggersCount + errorTriggersCount)) * 100) 
    : 100;

  return (
    <div className="container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <i className="fab fa-instagram gradient-icon"></i>
          </div>
          <div className="brand-name">
            <h2>InstaResponder</h2>
            <span>Auto-DM & Reply</span>
          </div>
        </div>
        
        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard-tab')}
          >
            <i className="fas fa-chart-line"></i> Dashboard & Logs
          </button>
          <button 
            className={`nav-item ${activeTab === 'campaigns-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('campaigns-tab')}
          >
            <i className="fas fa-bullhorn"></i> Campaigns
          </button>
          <button 
            className={`nav-item ${activeTab === 'settings-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings-tab')}
          >
            <i className="fas fa-sliders-h"></i> Bot Settings
          </button>
          <button 
            className={`nav-item ${activeTab === 'setup-tab' ? 'active' : ''}`}
            onClick={() => setActiveTab('setup-tab')}
          >
            <i className="fas fa-book-open"></i> Setup Guide
          </button>
        </nav>

        <div className="bot-toggle-panel">
          <div className="toggle-status">
            <span className="status-label">Bot Status</span>
            <span className={`badge ${config.isEnabled ? 'active-badge' : 'disabled-badge'}`}>
              {config.isEnabled ? 'ACTIVE' : 'DISABLED'}
            </span>
          </div>
          <label className="switch">
            <input 
              type="checkbox" 
              checked={config.isEnabled}
              onChange={handleMasterToggle}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-title">
            <h1>
              {activeTab === 'dashboard-tab' && 'Dashboard & Logs'}
              {activeTab === 'campaigns-tab' && 'Instagram Campaigns'}
              {activeTab === 'settings-tab' && 'Bot Configuration'}
              {activeTab === 'setup-tab' && 'Integration Setup Guide'}
            </h1>
            <p>
              {activeTab === 'dashboard-tab' && 'Monitor and test your Instagram interactions in real-time'}
              {activeTab === 'campaigns-tab' && 'Select any post/video from your Instagram account to configure custom comment triggers'}
              {activeTab === 'settings-tab' && 'Configure default keywords, public replies, and private DMs'}
              {activeTab === 'setup-tab' && 'Learn how to link your Facebook Page, generate credentials, and set up webhooks'}
            </p>
          </div>
          <div className="header-actions">
            <div className="webhook-indicator">
              <span className="pulse-dot"></span>
              <span className="indicator-text">Webhook Listener Online</span>
            </div>
          </div>
        </header>

        {/* TAB 1: DASHBOARD & LOGS */}
        {activeTab === 'dashboard-tab' && (
          <section className="tab-content active">
            {/* Stats Overview Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon purple-glow"><i className="fas fa-comment-dots"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Total Triggers</span>
                  <h3>{totalTriggersCount}</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green-glow"><i className="fas fa-paper-plane"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Success Rate</span>
                  <h3>{successRate}%</h3>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon pink-glow"><i className="fas fa-bolt"></i></div>
                <div className="stat-info">
                  <span className="stat-label">Active Keywords</span>
                  <h3>{config.keywords ? config.keywords.split(',').length : 0} Keywords</h3>
                </div>
              </div>
            </div>

            {/* Simulation & Logs Columns */}
            <div className="dashboard-body">
              {/* Left: Real-time logs */}
              <div className="logs-panel card">
                <div className="card-header">
                  <h3><i className="fas fa-terminal"></i> Activity Log</h3>
                  <div className="card-actions">
                    <button onClick={handleClearLogs} className="btn btn-secondary btn-sm">
                      <i className="fas fa-trash-alt"></i> Clear Logs
                    </button>
                    <button onClick={loadLogs} className="btn btn-primary btn-sm">
                      <i className="fas fa-sync-alt"></i> Refresh
                    </button>
                  </div>
                </div>
                
                <div className="logs-container">
                  {logs.length === 0 ? (
                    <div className="empty-logs">
                      <i className="fas fa-history"></i>
                      <p>No logs found. Simulate a comment or receive webhooks to start logging.</p>
                    </div>
                  ) : (
                    logs.map((log) => {
                      const date = new Date(log.timestamp);
                      const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
                                           ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      
                      const showDetailsToggle = log.details && Object.keys(log.details).length > 0;
                      const isExpanded = !!expandedLogs[log.id];

                      return (
                        <div key={log.id || log._id} className={`log-item log-${log.type}`}>
                          <div className="log-meta">
                            <div className="log-meta-left">
                              <span className="log-badge">{log.type}</span>
                              <span className="log-time">{formattedTime}</span>
                            </div>
                          </div>
                          <div className="log-message">{log.message}</div>
                          
                          {/* MOCK postback click simulator */}
                          {log.details && log.details.isFollowGateMock && (
                            <div style={{ marginTop: '10px', marginBottom: '5px' }}>
                              <button 
                                className="btn btn-gradient btn-sm"
                                style={{ padding: '4px 10px', fontSize: '0.75rem', minWidth: 'auto', cursor: 'pointer' }}
                                onClick={() => triggerMockPostback(
                                  log.details.ruleId,
                                  log.details.commentId,
                                  log.details.userId,
                                  log.details.username
                                )}
                              >
                                <i className="fas fa-sync-alt"></i> Simulate Click: "Try Again 🔄"
                              </button>
                            </div>
                          )}

                          {showDetailsToggle && (
                            <>
                              <button 
                                className="log-details-toggle"
                                onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id]: !isExpanded }))}
                              >
                                {isExpanded ? 'Hide Details' : 'View Details'}
                              </button>
                              {isExpanded && (
                                <pre className="log-details-block">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Webhook Simulator */}
              <div className="simulator-panel card">
                <div className="card-header">
                  <h3><i className="fas fa-vial"></i> Test Simulator</h3>
                </div>
                <div className="card-body">
                  <p className="section-description">Test your keywords, replies, and DM logic locally without deploying or waiting for comment events.</p>
                  <form onSubmit={handleRunSimulationSubmit} className="form-grid">
                    <div className="form-group">
                      <label htmlFor="sim-username">Test Username</label>
                      <div className="input-icon">
                        <i className="fas fa-at"></i>
                        <input 
                          type="text" 
                          id="sim-username" 
                          value={simUsername} 
                          onChange={(e) => setSimUsername(e.target.value)}
                          required 
                          placeholder="username"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="sim-comment">Comment Text</label>
                      <div className="input-icon">
                        <i className="far fa-comment"></i>
                        <input 
                          type="text" 
                          id="sim-comment" 
                          value={simComment} 
                          onChange={(e) => setSimComment(e.target.value)}
                          required 
                          placeholder="e.g. pdf, sent, I want it!"
                        />
                      </div>
                      <span className="input-tip">Use keywords configured in settings or campaign rules. Use `notfollowing` to test follow gating.</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="sim-media-id">Instagram Media ID (Optional)</label>
                      <div className="input-icon">
                        <i className="fas fa-photo-video"></i>
                        <input 
                          type="text" 
                          id="sim-media-id" 
                          value={simMediaId}
                          onChange={(e) => setSimMediaId(e.target.value)}
                          placeholder="e.g. 18092504771363564"
                        />
                      </div>
                      <span className="input-tip">Leave blank to simulate a default/generic post comment.</span>
                    </div>
                    <div className="form-group-checkbox">
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={simIsReply}
                          onChange={(e) => setSimIsReply(e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Simulate as Sub-comment Reply (Child)
                      </label>
                    </div>
                    <button type="submit" className="btn btn-gradient btn-full">
                      <i className="fas fa-play"></i> Run Test Trigger
                    </button>
                  </form>
                  
                  {!config.pageAccessToken && (
                    <div className="alert-box alert-warning" style={{ marginTop: '20px' }}>
                      <i className="fas fa-exclamation-triangle"></i>
                      <div>
                        <strong>Access Token Missing!</strong>
                        <p>Simulated checking will work, but real API calls to Instagram will fail until you enter your Page Access Token in Settings.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: CAMPAIGNS (POST-SPECIFIC AUTOMATIONS) */}
        {activeTab === 'campaigns-tab' && (
          <section className="tab-content active">
            <div className="campaigns-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configure triggers and automation templates for individual posts</p>
              </div>
              <div 
                className="badge" 
                style={{ 
                  background: 'rgba(138,43,226,0.15)', 
                  border: '1px solid var(--border-glow)', 
                  padding: '6px 12px', 
                  borderRadius: '8px', 
                  fontWeight: '500' 
                }}
              >
                {isMediaLoading ? (
                  <>
                    <i className="fas fa-sync fa-spin" style={{ marginRight: '6px' }}></i> Loading Posts...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle" style={{ marginRight: '6px', color: 'var(--color-success)' }}></i>
                    {isMediaMock ? 'Mock API Active (Fallback)' : 'Live API Active'}
                  </>
                )}
              </div>
            </div>

            {isMediaLoading ? (
              <div className="empty-logs" style={{ padding: '80px 0' }}>
                <i className="fas fa-circle-notch fa-spin"></i>
                <p>Retrieving posts from Instagram account...</p>
              </div>
            ) : (
              <div className="posts-grid">
                {mediaList.length === 0 ? (
                  <div className="empty-logs">
                    <i className="fas fa-photo-video"></i>
                    <p>No Instagram posts found. Make sure your account has uploaded posts or videos.</p>
                  </div>
                ) : (
                  mediaList.map((post) => {
                    const campaignRule = campaigns.find(c => c.mediaId === post.id);
                    const formattedDate = new Date(post.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

                    return (
                      <div key={post.id} className="post-card">
                        <div className="post-media-container">
                          {campaignRule ? (
                            <span className="post-badge active-automation">Active Automation</span>
                          ) : (
                            <span className="post-badge no-automation">No Rules Set</span>
                          )}
                          <img 
                            src={getMediaSrc(post)} 
                            alt="Post Media" 
                            onError={(e) => {
                              // If image fails, use visual placeholder gradient
                              e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop';
                            }}
                          />
                        </div>
                        <div className="post-card-content">
                          <p className="post-caption">{post.caption || 'No caption provided'}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <span className="post-date" style={{ marginBottom: 0 }}>{formattedDate}</span>
                            <div className="post-metrics" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span className="metric-item" title="Likes" style={{ marginRight: '2px' }}>
                                <i className="far fa-heart" style={{ color: 'var(--accent-pink)', marginRight: '4px' }}></i>
                                {post.like_count !== undefined ? post.like_count.toLocaleString() : 0}
                              </span>
                              <span className="metric-item" title="Comments" style={{ marginRight: '2px' }}>
                                <i className="far fa-comment" style={{ color: 'var(--color-info)', marginRight: '4px' }}></i>
                                {post.comments_count !== undefined ? post.comments_count.toLocaleString() : 0}
                              </span>
                              {post.permalink && (
                                <a 
                                  href={post.permalink} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="metric-item" 
                                  title="View Live Post on Instagram"
                                  style={{ color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', transition: 'color var(--transition-fast)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-pink)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  <i className="fab fa-instagram"></i>
                                </a>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => openModal(post)} 
                            className={`btn btn-full ${campaignRule ? 'btn-primary' : 'btn-gradient'}`}
                          >
                            <i className={campaignRule ? 'fas fa-edit' : 'fas fa-plus'}></i>
                            {campaignRule ? 'Edit Automation' : 'Set Automation'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: BOT SETTINGS */}
        {activeTab === 'settings-tab' && (
          <section className="tab-content active">
            <div className="card settings-card">
              <div className="card-header">
                <h3><i className="fas fa-cog"></i> Configuration Panel</h3>
                <span className="header-tag">Changes take effect immediately</span>
              </div>
              <div className="card-body">
                <form onSubmit={handleSaveConfigSubmit}>
                  {/* Meta Access Credentials */}
                  <div className="form-section">
                    <h4><i className="fas fa-key"></i> Meta API Authorization</h4>
                    <div className="form-group">
                      <label htmlFor="pageAccessToken">Page Access Token</label>
                      <div className="input-wrapper">
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          id="pageAccessToken" 
                          value={config.pageAccessToken || ''}
                          onChange={(e) => setConfig(prev => ({ ...prev, pageAccessToken: e.target.value }))}
                          placeholder="EAABw..." 
                          className="password-input"
                        />
                        <button 
                          type="button" 
                          className="toggle-password-btn" 
                          onClick={() => setShowPassword(prev => !prev)}
                        >
                          <i className={showPassword ? 'far fa-eye-slash' : 'far fa-eye'}></i>
                        </button>
                      </div>
                      <span className="input-tip">Generated in your Meta Developer portal. Ensure it has the page scope permissions. Setting/changing this automatically triggers webhook registration!</span>
                    </div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label htmlFor="verifyToken">Webhook Verify Token</label>
                        <input 
                          type="text" 
                          id="verifyToken" 
                          value={config.verifyToken || ''}
                          onChange={(e) => setConfig(prev => ({ ...prev, verifyToken: e.target.value }))}
                          required 
                          placeholder="my_secure_verify_token"
                        />
                        <span className="input-tip">Must match the Verify Token used in the Webhooks setting on developers.facebook.com.</span>
                      </div>
                      <div className="form-group">
                        <label htmlFor="instagramUsername">Your IG Username (Without @)</label>
                        <input 
                          type="text" 
                          id="instagramUsername" 
                          value={config.instagramUsername || ''}
                          onChange={(e) => setConfig(prev => ({ ...prev, instagramUsername: e.target.value }))}
                          placeholder="e.g. startwith.surya"
                        />
                        <span className="input-tip">Required to prevent loops when the page comments on its own posts.</span>
                      </div>
                    </div>
                  </div>

                  {/* Bot Actions & Rules */}
                  <div className="form-section">
                    <h4><i className="fas fa-robot"></i> Default Reply Automation Rules</h4>
                    <div className="form-group">
                      <label htmlFor="keywords">Trigger Keywords (Comma separated)</label>
                      <input 
                        type="text" 
                        id="keywords" 
                        value={config.keywords || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, keywords: e.target.value }))}
                        required 
                        placeholder="e.g. sent, pdf, link, ebook"
                      />
                      <span className="input-tip">If a comment contains any of these words (case-insensitive), the automation triggers.</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="publicReply">Public Reply Message</label>
                      <input 
                        type="text" 
                        id="publicReply" 
                        value={config.publicReply || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, publicReply: e.target.value }))}
                        required 
                        placeholder="Sent ✅ Follow me and check your DM."
                      />
                      <span className="input-tip">The public comment the bot posts in response to the user. Keep it natural!</span>
                    </div>
                    <div className="form-group">
                      <label htmlFor="privateDM">Private DM Content</label>
                      <textarea 
                        id="privateDM" 
                        rows="4" 
                        value={config.privateDM || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, privateDM: e.target.value }))}
                        required 
                        placeholder="Hey! Here is the content 👇..."
                      ></textarea>
                      <span className="input-tip">The direct message sent to the user. Insert your links, details or instructions.</span>
                    </div>

                    <div className="form-group-checkbox" style={{ marginTop: '15px', marginBottom: '15px' }}>
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          id="useRichCard" 
                          checked={!!config.useRichCard}
                          onChange={(e) => setConfig(prev => ({ ...prev, useRichCard: e.target.checked }))}
                        />
                        <span className="checkmark"></span>
                        Use Interactive Rich Card DM (Generic Template)
                      </label>
                      <span className="input-tip italic-tip">Sends a beautiful card with a title, image, and direct link button instead of a text URL.</span>
                    </div>

                    {config.useRichCard && (
                      <div className="rich-card-settings-group" style={{ 
                        marginTop: '15px', 
                        marginBottom: '20px',
                        padding: '18px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px dashed var(--border-glow)', 
                        borderRadius: '12px' 
                      }}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                          <label htmlFor="cardTitle">Card Title</label>
                          <input 
                            type="text" 
                            id="cardTitle" 
                            value={config.cardTitle || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, cardTitle: e.target.value }))}
                            placeholder="e.g. Your Resource is Ready! 🎉"
                            required={config.useRichCard}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
                          <label htmlFor="cardSubtitle">Card Subtitle / Description</label>
                          <input 
                            type="text" 
                            id="cardSubtitle" 
                            value={config.cardSubtitle || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, cardSubtitle: e.target.value }))}
                            placeholder="e.g. Click the button below to download."
                          />
                        </div>
                        <div className="form-grid-2" style={{ marginBottom: '15px' }}>
                          <div className="form-group">
                            <label htmlFor="cardButtonText">Button Label</label>
                            <input 
                              type="text" 
                              id="cardButtonText" 
                              value={config.cardButtonText || ''}
                              onChange={(e) => setConfig(prev => ({ ...prev, cardButtonText: e.target.value }))}
                              placeholder="e.g. Download Now 📥"
                              required={config.useRichCard}
                            />
                          </div>
                          <div className="form-group">
                            <label htmlFor="cardButtonUrl">Button Link URL</label>
                            <input 
                              type="text" 
                              id="cardButtonUrl" 
                              value={config.cardButtonUrl || ''}
                              onChange={(e) => setConfig(prev => ({ ...prev, cardButtonUrl: e.target.value }))}
                              placeholder="e.g. https://example.com/your-pdf"
                              required={config.useRichCard}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label htmlFor="cardImage">Card Image URL (Optional)</label>
                          <input 
                            type="text" 
                            id="cardImage" 
                            value={config.cardImage || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, cardImage: e.target.value }))}
                            placeholder="e.g. https://example.com/mockup.jpg"
                          />
                          <span className="input-tip">Provide a direct HTTPS URL to a JPG/PNG image (max 1MB).</span>
                        </div>
                      </div>
                    )}

                    <div className="form-group-checkbox">
                      <label className="checkbox-container">
                        <input 
                          type="checkbox" 
                          id="ignoreReplies" 
                          checked={!!config.ignoreReplies}
                          onChange={(e) => setConfig(prev => ({ ...prev, ignoreReplies: e.target.checked }))}
                        />
                        <span className="checkmark"></span>
                        Ignore comments that are replies to other comments
                      </label>
                      <span className="input-tip italic-tip">Highly recommended. Prevents auto-reply loops in sub-comment threads.</span>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="form-actions-bar">
                    <button 
                      type="button" 
                      onClick={() => {
                        if (window.confirm('Reset values to defaults?')) {
                          setConfig(prev => ({
                            ...prev,
                            verifyToken: 'my_secure_verify_token_123',
                            keywords: 'sent, pdf, link',
                            publicReply: 'Sent ✅ Follow me and check your DM.',
                            privateDM: 'Hey! Here is the content 👇\n\nhttps://example.com/your-pdf-link',
                            ignoreReplies: true
                          }));
                          showToast('Form reset to default templates.', 'info');
                        }
                      }}
                      className="btn btn-secondary"
                    >
                      Reset to Defaults
                    </button>
                    <button type="submit" className="btn btn-gradient">
                      <i className="fas fa-save"></i> Save Configuration
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: SETUP GUIDE */}
        {activeTab === 'setup-tab' && (
          <section className="tab-content active">
            <div className="card guide-card">
              <div className="card-header">
                <h3><i className="fas fa-directions"></i> Complete Step-by-Step Meta Setup Guide</h3>
              </div>
              <div className="card-body">
                {/* Horizontal Process Steps */}
                <div className="process-steps">
                  <div className={`step-indicator ${setupStep === 1 ? 'active' : ''} ${setupStep > 1 ? 'completed' : ''}`} onClick={() => setSetupStep(1)}>
                    <div className="step-num">{setupStep > 1 ? <i className="fas fa-check"></i> : '1'}</div>
                    <span className="step-text">Accounts</span>
                  </div>
                  <div className={`step-indicator ${setupStep === 2 ? 'active' : ''} ${setupStep > 2 ? 'completed' : ''}`} onClick={() => setSetupStep(2)}>
                    <div className="step-num">{setupStep > 2 ? <i className="fas fa-check"></i> : '2'}</div>
                    <span className="step-text">Meta App</span>
                  </div>
                  <div className={`step-indicator ${setupStep === 3 ? 'active' : ''} ${setupStep > 3 ? 'completed' : ''}`} onClick={() => setSetupStep(3)}>
                    <div className="step-num">{setupStep > 3 ? <i className="fas fa-check"></i> : '3'}</div>
                    <span className="step-text">Token & Webhook</span>
                  </div>
                  <div className={`step-indicator ${setupStep === 4 ? 'active' : ''}`} onClick={() => setSetupStep(4)}>
                    <div className="step-num">4</div>
                    <span className="step-text">Tunneling</span>
                  </div>
                </div>

                {/* Step Contents */}
                <div className="steps-content-container">
                  {setupStep === 1 && (
                    <div className="step-details active">
                      <h3>1. Prepare Your Accounts</h3>
                      <p>To automate Instagram with the Meta Graph API, you must link your Instagram page to a Facebook Page:</p>
                      <ul className="guide-list">
                        <li><i className="fas fa-check-circle"></i> Convert your Instagram account to a <strong>Professional Account</strong> (either <em>Creator</em> or <em>Business</em>).</li>
                        <li><i className="fas fa-check-circle"></i> Create a <strong>Facebook Page</strong> for your business or brand.</li>
                        <li><i className="fas fa-check-circle"></i> In Instagram App, go to Settings &rarr; Creator Tools &rarr; Connect/Link a Page, and select your FB Page.</li>
                        <li><i className="fas fa-check-circle"></i> <strong>Crucial Option:</strong> In Instagram, go to <em>Settings &rarr; Privacy &rarr; Messages</em> and make sure **"Allow Access to Messages"** is turned <strong>ON</strong>. Without this, external apps cannot read or send DMs.</li>
                      </ul>
                      <div className="guide-nav-buttons">
                        <button className="btn btn-gradient" onClick={() => setSetupStep(2)}>
                          Next Step: Create Meta App <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 2 && (
                    <div className="step-details active">
                      <h3>2. Configure the Meta Use Cases</h3>
                      <p>Newer Meta Developer Accounts require adding specific Use Cases to access Instagram endpoints:</p>
                      <ul className="guide-list">
                        <li><i className="fas fa-check-circle"></i> Go to the <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer">Meta Developer Portal</a>.</li>
                        <li><i className="fas fa-check-circle"></i> Select your app (or create a new one of type <strong>Business</strong>).</li>
                        <li><i className="fas fa-check-circle"></i> Click <strong>Use cases</strong> in the left sidebar menu.</li>
                        <li><i className="fas fa-check-circle"></i> Find **"Engage with customers on Messenger from Meta"** and click **Set Up/Save**.</li>
                        <li><i className="fas fa-check-circle"></i> Make sure the **Instagram Graph API** use case is also enabled.</li>
                      </ul>
                      <div className="guide-nav-buttons">
                        <button className="btn btn-secondary" onClick={() => setSetupStep(1)}>
                          <i className="fas fa-arrow-left"></i> Previous
                        </button>
                        <button className="btn btn-gradient" onClick={() => setSetupStep(3)}>
                          Next Step: Configure Token <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 3 && (
                    <div className="step-details active">
                      <h3>3. Obtain Page Access Token & Configure Webhooks</h3>
                      <p>Generate a Page token that inherits the required scopes to read and send messages:</p>
                      <ul className="guide-list">
                        <li><i className="fas fa-check-circle"></i> Go to the Graph API Explorer tool in your dashboard.</li>
                        <li><i className="fas fa-check-circle"></i> Select **User Access Token** in the dropdown.</li>
                        <li><i className="fas fa-check-circle"></i> Add permissions: `pages_messaging`, `pages_manage_metadata`, `instagram_manage_messages`, `instagram_basic`, and `pages_show_list`.</li>
                        <li><i className="fas fa-check-circle"></i> Click **Generate Access Token**. Exchange it for a 60-day token, and call `GET /me/accounts` in your browser to grab the permanent Page Access Token.</li>
                        <li><i className="fas fa-check-circle"></i> Paste this Page Access Token in our dashboard **Settings** tab. The bot will automatically subscribe your Page to the webhooks.</li>
                      </ul>
                      <div className="guide-nav-buttons">
                        <button className="btn btn-secondary" onClick={() => setSetupStep(2)}>
                          <i className="fas fa-arrow-left"></i> Previous
                        </button>
                        <button className="btn btn-gradient" onClick={() => setSetupStep(4)}>
                          Next Step: Tunneling Local Server <i className="fas fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  )}

                  {setupStep === 4 && (
                    <div className="step-details active">
                      <h3>4. Expose Webhook Tunneling (ngrok)</h3>
                      <p>Expose your local development server with SSL tunnel to receive webhook events from Meta:</p>
                      <ol className="guide-numbered-list">
                        <li>Download and run <a href="https://ngrok.com/" target="_blank" rel="noreferrer">ngrok</a>.</li>
                        <li>Expose port 3000 locally:
                          <pre className="code-block">ngrok http 3000</pre>
                        </li>
                        <li>Copy the generated ngrok `https` URL and append `/webhook` (e.g. `https://xxxx.ngrok-free.app/webhook`).</li>
                        <li>Paste it in your Meta App Webhook settings Callback URL field. Make sure Verify Token matches your configured value.</li>
                      </ol>
                      <div className="alert-box alert-success" style={{ marginTop: '20px' }}>
                        <i className="fas fa-info-circle"></i>
                        <div>
                          <strong>Ready to Deploy?</strong>
                          <p>Since we are now using a MongoDB database, you can host this code on services like Render, Railway, or Fly.io without losing your setups on restart!</p>
                        </div>
                      </div>
                      <div className="guide-nav-buttons">
                        <button className="btn btn-secondary" onClick={() => setSetupStep(3)}>
                          <i className="fas fa-arrow-left"></i> Previous
                        </button>
                        <button className="btn btn-gradient" onClick={() => setActiveTab('dashboard-tab')}>
                          Back to Dashboard <i className="fas fa-home"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Notification Toast */}
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          <i className={
            toast.type === 'success' ? 'fas fa-check-circle' :
            toast.type === 'error' ? 'fas fa-exclamation-triangle' :
            'fas fa-info-circle'
          }></i>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Campaign Editor Modal */}
      {activeModalPost && (
        <div className="modal-overlay active">
          <div className="card modal-content-card">
            <div 
              className="card-header" 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '15px', 
                marginBottom: '15px' 
              }}
            >
              <h3>
                <i className="fas fa-robot"></i> 
                {modalForm.id ? ' Edit Automation' : ' Set Automation'}
              </h3>
              <button 
                type="button" 
                onClick={closeModal}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  fontSize: '1.8rem', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  outline: 'none' 
                }}
              >
                &times;
              </button>
            </div>
            
            <div className="card-body">
              {/* Post Preview (Mini) */}
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '15px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-color)', 
                  padding: '12px', 
                  borderRadius: '10px', 
                  marginBottom: '20px' 
                }}
              >
                <img 
                  src={getMediaSrc(activeModalPost)} 
                  alt="Thumbnail" 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    objectFit: 'cover', 
                    borderRadius: '6px', 
                    border: '1px solid var(--border-color)' 
                  }}
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop';
                  }}
                />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Post</span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '4px', lineHeight: 1.3 }}>
                    {activeModalPost.caption || 'No caption'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveCampaignSubmit}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="campaignName">Campaign Name</label>
                  <input 
                    type="text" 
                    id="campaignName" 
                    value={modalForm.name}
                    onChange={(e) => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                    required 
                    placeholder="e.g. Lead Magnet Video Automation"
                  />
                </div>

                <div className="form-group-checkbox" style={{ marginBottom: '15px' }}>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={modalForm.triggerOnAny}
                      onChange={(e) => setModalForm(prev => ({ ...prev, triggerOnAny: e.target.checked }))}
                    />
                    <span className="checkmark"></span>
                    Trigger on <strong>any comment</strong> (No keyword required)
                  </label>
                </div>
                
                {!modalForm.triggerOnAny && (
                  <div className="form-group" style={{ marginBottom: '15px' }}>
                    <label htmlFor="campaignKeywords">Trigger Keywords (Comma separated)</label>
                    <input 
                      type="text" 
                      id="campaignKeywords" 
                      value={modalForm.keywords}
                      onChange={(e) => setModalForm(prev => ({ ...prev, keywords: e.target.value }))}
                      required={!modalForm.triggerOnAny}
                      placeholder="e.g. pdf, send, link"
                    />
                    <span className="input-tip">If someone comments any of these words on this post, the DM will send.</span>
                  </div>
                )}
                
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="campaignPublicReply">Public Comment Reply</label>
                  <input 
                    type="text" 
                    id="campaignPublicReply" 
                    value={modalForm.publicReply}
                    onChange={(e) => setModalForm(prev => ({ ...prev, publicReply: e.target.value }))}
                    required 
                    placeholder="Sent! Check your DM 📬"
                  />
                </div>
                
                <div className="form-group-checkbox" style={{ marginBottom: '15px' }}>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={modalForm.requireFollow}
                      onChange={(e) => setModalForm(prev => ({ ...prev, requireFollow: e.target.checked }))}
                    />
                    <span className="checkmark"></span>
                    Enable <strong>Follow Gate</strong> (Require user to follow your profile to get the resource)
                  </label>
                </div>

                 <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label htmlFor="campaignPrivateDM">
                    {modalForm.requireFollow ? 'Private DM Message (If Following)' : 'Private DM Message'}
                  </label>
                  <textarea 
                    id="campaignPrivateDM" 
                    rows="4" 
                    value={modalForm.privateDM}
                    onChange={(e) => setModalForm(prev => ({ ...prev, privateDM: e.target.value }))}
                    required 
                    placeholder="Hey! Here is the link you requested..."
                  ></textarea>
                </div>

                <div className="form-group-checkbox" style={{ marginBottom: '15px' }}>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={modalForm.useRichCard}
                      onChange={(e) => setModalForm(prev => ({ ...prev, useRichCard: e.target.checked }))}
                    />
                    <span className="checkmark"></span>
                    Use Interactive Rich Card DM (Generic Template)
                  </label>
                  <span className="input-tip italic-tip" style={{ display: 'block', marginLeft: '28px', marginTop: '-4px' }}>
                    Sends a beautiful rich card with an image, title, and action button instead of plain text URL!
                  </span>
                </div>

                {modalForm.useRichCard && (
                  <div className="rich-card-settings-group" style={{ 
                    marginBottom: '20px',
                    padding: '15px', 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px dashed var(--border-glow)', 
                    borderRadius: '10px' 
                  }}>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="modalCardTitle">Card Title</label>
                      <input 
                        type="text" 
                        id="modalCardTitle" 
                        value={modalForm.cardTitle}
                        onChange={(e) => setModalForm(prev => ({ ...prev, cardTitle: e.target.value }))}
                        placeholder="e.g. Your PDF Guide is Ready! 🎉"
                        required={modalForm.useRichCard}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label htmlFor="modalCardSubtitle">Card Subtitle / Description</label>
                      <input 
                        type="text" 
                        id="modalCardSubtitle" 
                        value={modalForm.cardSubtitle}
                        onChange={(e) => setModalForm(prev => ({ ...prev, cardSubtitle: e.target.value }))}
                        placeholder="e.g. Click the button below to download the resource."
                      />
                    </div>
                    <div className="form-grid-2" style={{ marginBottom: '12px' }}>
                      <div className="form-group">
                        <label htmlFor="modalCardButtonText">Button Label</label>
                        <input 
                          type="text" 
                          id="modalCardButtonText" 
                          value={modalForm.cardButtonText}
                          onChange={(e) => setModalForm(prev => ({ ...prev, cardButtonText: e.target.value }))}
                          placeholder="e.g. Download Now 📥"
                          required={modalForm.useRichCard}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="modalCardButtonUrl">Button Link URL</label>
                        <input 
                          type="text" 
                          id="modalCardButtonUrl" 
                          value={modalForm.cardButtonUrl}
                          onChange={(e) => setModalForm(prev => ({ ...prev, cardButtonUrl: e.target.value }))}
                          placeholder="e.g. https://example.com/your-pdf"
                          required={modalForm.useRichCard}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="modalCardImage">Card Image URL (Optional)</label>
                      <input 
                        type="text" 
                        id="modalCardImage" 
                        value={modalForm.cardImage}
                        onChange={(e) => setModalForm(prev => ({ ...prev, cardImage: e.target.value }))}
                        placeholder="e.g. https://example.com/mockup.jpg"
                      />
                      <span className="input-tip">Provide a direct HTTPS URL to a JPG/PNG image (max 1MB). If left blank, it will send the card text and buttons without an image.</span>
                    </div>
                  </div>
                )}

                {modalForm.requireFollow && (
                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label htmlFor="campaignFollowFallbackDM">Private DM Message (If NOT Following)</label>
                    <textarea 
                      id="campaignFollowFallbackDM" 
                      rows="4" 
                      value={modalForm.followFallbackDM}
                      onChange={(e) => setModalForm(prev => ({ ...prev, followFallbackDM: e.target.value }))}
                      required={modalForm.requireFollow}
                      placeholder="Hey! Thanks for commenting. Please follow my profile first, then comment again to unlock your resource!"
                    ></textarea>
                    <span className="input-tip">This message is sent with "Visit Profile" and "Try Again 🔄" buttons.</span>
                  </div>
                )}
                
                <div 
                  className="form-actions-bar" 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    gap: '15px', 
                    borderTop: '1px solid var(--border-color)', 
                    paddingTop: '15px', 
                    marginTop: '15px' 
                  }}
                >
                  {modalForm.id ? (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteCampaign(modalForm.id)}
                      className="btn btn-secondary" 
                      style={{ color: 'var(--color-error)', borderColor: 'rgba(255, 23, 68, 0.2)' }}
                    >
                      <i className="fas fa-trash-alt"></i> Delete Automation
                    </button>
                  ) : (
                    <div style={{ flexGrow: 1 }}></div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <button type="button" onClick={closeModal} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-gradient"><i class="fas fa-save"></i> Save Rules</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
