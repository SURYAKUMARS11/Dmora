import { useState, useEffect } from 'react';

function App() {
  // Authentication State
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [isRegistering, setIsRegistering] = useState(false); // Toggle signup vs login

  // User Profile details (for tiering limits and user context)
  const [userProfile, setUserProfile] = useState(null);

  // Form Inputs for Auth
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');

  // Meta OAuth & Page Selector State
  const [connectedPages, setConnectedPages] = useState([]);
  const [isFetchingPages, setIsFetchingPages] = useState(false);

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

  // Analytics State
  const [analytics, setAnalytics] = useState({ trend: [], campaigns: [] });

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

  // Helper: Wrapper for fetch with Authorization header injection and status handling
  const fetchWithAuth = async (url, options = {}) => {
    const headers = options.headers || {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Default Content-Type if not specified and body is present
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      localStorage.removeItem('adminToken');
      setToken('');
      setIsAuthenticated(false);
      showToast('Session expired. Please log in again.', 'error');
      throw new Error('Unauthorized');
    }
    return res;
  };

  // Handle User Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (authPassword !== authConfirmPassword) {
      showToast('Passwords do not match!', 'error');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        showToast('Account registered successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to register account', 'error');
      }
    } catch (err) {
      showToast('Connection error during registration', 'error');
    }
  };

  // Handle User Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
        showToast('Logged in successfully!', 'success');
      } else {
        showToast(data.error || 'Invalid credentials', 'error');
      }
    } catch (err) {
      showToast('Connection error during login', 'error');
    }
  };

  // Log out
  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken('');
    setIsAuthenticated(false);
    showToast('Logged out successfully', 'info');
  };

  // Trigger Facebook OAuth connect
  const handleFacebookConnect = async () => {
    try {
      showToast('Initiating Facebook secure connection...', 'info');
      const res = await fetchWithAuth('/api/auth/facebook');
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url; // Redirect browser to Facebook OAuth dialog
      } else {
        showToast(data.error || 'Failed to generate connection link', 'error');
      }
    } catch (err) {
      showToast('Error connecting to authentication server', 'error');
    }
  };

  // Load connected Facebook pages (with Instagram accounts)
  const loadConnectedPages = async () => {
    setIsFetchingPages(true);
    try {
      const res = await fetchWithAuth('/api/auth/facebook/pages');
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectedPages(data.pages || []);
        if (data.pages?.length === 0) {
          showToast('No Instagram business pages found linked to this Facebook account.', 'warning');
        }
      } else {
        showToast(data.error || 'Failed to load Facebook Pages', 'error');
        setConnectedPages([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error loading pages list', 'error');
    } finally {
      setIsFetchingPages(false);
    }
  };

  // Activate specific page and trigger webhook subscriptions
  const handleActivatePage = async (page) => {
    try {
      showToast(`Activating bot for @${page.instagramAccount.username}...`, 'info');
      const res = await fetchWithAuth('/api/auth/facebook/activate', {
        method: 'POST',
        body: JSON.stringify({
          pageId: page.pageId,
          pageAccessToken: page.pageAccessToken,
          instagramAccountId: page.instagramAccount.id,
          instagramUsername: page.instagramAccount.username
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Bot activated successfully for @${page.instagramAccount.username}!`, 'success');
        setConfig(data.config);
        setConnectedPages([]); // Clear list
      } else {
        showToast(data.error || 'Activation failed', 'error');
      }
    } catch (err) {
      showToast('Error activating bot connection', 'error');
    }
  };

  // Disconnect active page
  const handleDisconnectPage = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Instagram page? Your automations will stop.')) return;
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'POST',
        body: JSON.stringify({
          pageAccessToken: '',
          facebookPageId: '',
          instagramBusinessId: '',
          instagramUsername: '',
          isEnabled: false
        })
      });
      if (res.ok) {
        showToast('Instagram page disconnected successfully.', 'info');
        loadConfig();
      }
    } catch (err) {
      showToast('Error disconnecting page', 'error');
    }
  };

  // Fetch Logged-In User Profile Details (for Subscription/Billing Limits)
  const loadUserProfile = async () => {
    try {
      const res = await fetchWithAuth('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  // Handle Subscription Upgrades with Razorpay (India First Checkout Flow)
  const handleUpgradeSubscription = async () => {
    try {
      showToast('Creating subscription checkout...', 'info');
      const res = await fetchWithAuth('/api/billing/subscribe', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || 'Failed to create subscription', 'error');
        return;
      }

      const { subscriptionId, planId, keyId, isMock } = data;

      if (isMock) {
        // Mock simulation upgrade flow
        if (window.confirm('Razorpay is running in local Simulator Mode. Would you like to mock-approve this payment to upgrade to PRO?')) {
          const verifyRes = await fetchWithAuth('/api/billing/verify', {
            method: 'POST',
            body: JSON.stringify({
              isMock: true,
              razorpay_subscription_id: subscriptionId
            })
          });
          
          if (verifyRes.ok) {
            showToast('Subscription mock-payment verified! Upgraded to PRO successfully.', 'success');
            loadUserProfile();
          } else {
            showToast('Mock-verification failed', 'error');
          }
        }
      } else {
        // Real Razorpay subscription integration
        const loadScript = (src) => {
          return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const scriptLoaded = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
        if (!scriptLoaded) {
          showToast('Razorpay Checkout SDK failed to load. Check your internet connection.', 'error');
          return;
        }

        const options = {
          key: keyId,
          subscription_id: subscriptionId,
          name: 'Dmora',
          description: 'Pro Plan Subscription (India)',
          image: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%238a2be2"/></svg>',
          handler: async function (response) {
            try {
              showToast('Verifying subscription signature...', 'info');
              const verifyRes = await fetchWithAuth('/api/billing/verify', {
                method: 'POST',
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  isMock: false
                })
              });
              
              if (verifyRes.ok) {
                showToast('Payment verified successfully! You are now a PRO member.', 'success');
                loadUserProfile();
              } else {
                showToast('Signature verification failed. Please contact support.', 'error');
              }
            } catch (err) {
              showToast('Verification request failed', 'error');
            }
          },
          prefill: {
            email: userProfile?.email || '',
            name: userProfile?.name || ''
          },
          theme: {
            color: '#D53F8C'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      console.error(err);
      showToast('Error launching upgrade checkout portal', 'error');
    }
  };

  // Fetch Config
  const loadConfig = async () => {
    try {
      const res = await fetchWithAuth('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // If Facebook connected but page not selected, load pages automatically
        if (data.facebookPageId === '' && data.pageAccessToken === '') {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('oauth_success')) {
            loadConnectedPages();
          }
        }
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  };

  // Fetch Campaigns
  const loadCampaigns = async () => {
    try {
      const res = await fetchWithAuth('/api/campaigns');
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
      const res = await fetchWithAuth('/api/instagram/media');
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
      const res = await fetchWithAuth('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error('Error loading logs:', e);
    }
  };

  // Fetch Analytics
  const loadAnalytics = async () => {
    try {
      const res = await fetchWithAuth('/api/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.error('Error loading analytics:', e);
    }
  };

  // Handle URL parameters for Facebook OAuth redirect checks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth_success')) {
      showToast('Facebook Account connected successfully!', 'success');
      setActiveTab('settings-tab');
      window.history.replaceState({}, document.title, window.location.pathname);
      if (isAuthenticated) {
        loadConfig();
        loadConnectedPages();
      }
    } else if (urlParams.get('oauth_error')) {
      showToast(`OAuth Connection Failed: ${urlParams.get('oauth_error').replace('_', ' ')}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [isAuthenticated]);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadUserProfile();
      loadConfig();
      loadCampaigns();
      loadMedia();
      loadLogs();
      loadAnalytics();

      // Poll logs & analytics every 3 seconds
      const interval = setInterval(() => {
        loadLogs();
        loadAnalytics();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  // Handle Master Toggle Status
  const handleMasterToggle = async (e) => {
    const isChecked = e.target.checked;
    setConfig(prev => ({ ...prev, isEnabled: isChecked }));
    
    try {
      const res = await fetchWithAuth('/api/config', {
        method: 'POST',
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
      const res = await fetchWithAuth('/api/config', {
        method: 'POST',
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
      const res = await fetchWithAuth('/api/clear-logs', { method: 'POST' });
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
      const res = await fetchWithAuth('/api/test-trigger', {
        method: 'POST',
        body: JSON.stringify({
          username: simUsername,
          text: simComment,
          mediaId: simMediaId,
          parent_id: simIsReply ? 'parent_comment_123' : undefined
        })
      });
      
      if (res.ok) {
        setTimeout(() => {
          loadLogs();
          loadAnalytics();
        }, 600);
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
      const response = await fetchWithAuth('/api/test-postback', {
        method: 'POST',
        body: JSON.stringify({ ruleId, commentId, userId, username })
      });
      
      if (response.ok) {
        setTimeout(() => {
          loadLogs();
          loadAnalytics();
        }, 600);
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
      const res = await fetchWithAuth('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(modalForm)
      });
      
      const result = await res.json();
      if (res.ok && result.success) {
        showToast(`Automation rule saved for post successfully!`, 'success');
        setCampaigns(result.rules || []);
        loadAnalytics(); // Refresh analytics table
        closeModal();
      } else {
        showToast(result.error || 'Failed to save rules', 'error');
      }
    } catch (err) {
      // Check if blocked by the tier limits gate
      if (err.message === 'Unauthorized') return;
      showToast('Error saving campaign rule. Limit reached on Free Tier!', 'error');
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete automation rules for this post?')) return;
    try {
      const res = await fetchWithAuth(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (res.ok && result.success) {
        showToast('Automation deleted successfully', 'info');
        setCampaigns(result.rules || []);
        loadAnalytics();
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

  // ---------------------------------------------------------
  // RENDER METHOD: SVG Neon 7-Day Trend Chart
  // ---------------------------------------------------------
  const renderTrendChart = () => {
    if (!analytics || !analytics.trend || analytics.trend.length === 0) return null;
    const trend = analytics.trend;
    
    const width = 800;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 30, left: 45 };
    
    const maxVal = Math.max(...trend.map(d => Math.max(d.success, d.error)), 5) * 1.15;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Calculate coordinates
    const successPoints = trend.map((d, i) => {
      const x = padding.left + (i * (chartWidth / (trend.length - 1)));
      const y = padding.top + chartHeight - ((d.success / maxVal) * chartHeight);
      return { x, y };
    });

    const errorPoints = trend.map((d, i) => {
      const x = padding.left + (i * (chartWidth / (trend.length - 1)));
      const y = padding.top + chartHeight - ((d.error / maxVal) * chartHeight);
      return { x, y };
    });

    const getPathD = (points) => {
      return points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');
    };

    const getAreaD = (points) => {
      if (points.length === 0) return '';
      const first = points[0];
      const last = points[points.length - 1];
      const pathD = getPathD(points);
      return `${pathD} L ${last.x} ${padding.top + chartHeight} L ${first.x} ${padding.top + chartHeight} Z`;
    };

    const successPath = getPathD(successPoints);
    const successArea = getAreaD(successPoints);
    const errorPath = getPathD(errorPoints);
    const errorArea = getAreaD(errorPoints);

    return (
      <div className="card" style={{ marginBottom: '30px' }}>
        <div className="card-header">
          <h3><i className="fas fa-chart-area"></i> 7-Day Bot Activity Trend</h3>
          <span className="badge" style={{ background: 'rgba(138, 43, 226, 0.15)', color: 'var(--accent-pink)', border: '1px solid var(--border-glow)' }}>
            Real-time Metrics
          </span>
        </div>
        <div className="card-body" style={{ position: 'relative', overflowX: 'auto', padding: '20px 24px' }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e676" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#00e676" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff1744" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#ff1744" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow-success" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="glow-error" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid lines (horizontal) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = padding.top + ratio * chartHeight;
              const val = Math.round(maxVal * (1 - ratio));
              return (
                <g key={idx}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x={padding.left - 12} y={y + 4} fill="var(--text-muted)" fontSize="0.75rem" textAnchor="end">{val}</text>
                </g>
              );
            })}

            {/* X Axis Labels */}
            {trend.map((d, i) => {
              const x = padding.left + (i * (chartWidth / (trend.length - 1)));
              return (
                <text key={i} x={x} y={height - 8} fill="var(--text-muted)" fontSize="0.75rem" textAnchor="middle">
                  {d.date}
                </text>
              );
            })}

            {/* Paths & Areas */}
            {successArea && <path d={successArea} fill="url(#successGrad)" />}
            {successPath && <path d={successPath} fill="none" stroke="#00e676" strokeWidth="2.5" filter="url(#glow-success)" strokeLinecap="round" />}
            
            {errorArea && <path d={errorArea} fill="url(#errorGrad)" />}
            {errorPath && <path d={errorPath} fill="none" stroke="#ff1744" strokeWidth="2" filter="url(#glow-error)" strokeLinecap="round" />}

            {/* Data Points Dots */}
            {successPoints.map((p, i) => (
              <circle key={`s-${i}`} cx={p.x} cy={p.y} r="4.5" fill="var(--bg-secondary)" stroke="#00e676" strokeWidth="2" title={`Success: ${trend[i].success}`} />
            ))}
            {errorPoints.map((p, i) => (
              <circle key={`e-${i}`} cx={p.x} cy={p.y} r="3.5" fill="var(--bg-secondary)" stroke="#ff1744" strokeWidth="1.5" title={`Error: ${trend[i].error}`} />
            ))}
          </svg>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '15px', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00e676' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00e676', display: 'inline-block' }}></span>
              Successful Auto-DMs
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff1744' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff1744', display: 'inline-block' }}></span>
              Failed Messages / API Errors
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------
  // RENDER METHOD: Campaign-Specific Performance Analytics Table
  // ---------------------------------------------------------
  const renderCampaignAnalyticsTable = () => {
    if (!analytics || !analytics.campaigns || analytics.campaigns.length === 0) {
      return (
        <div className="card" style={{ marginBottom: '30px' }}>
          <div className="card-header">
            <h3><i className="fas fa-chart-bar"></i> Post-Specific Automation Performance</h3>
          </div>
          <div className="card-body" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fas fa-bullhorn" style={{ fontSize: '2rem', opacity: '0.2', marginBottom: '10px', display: 'block' }}></i>
            No active campaign automations found to track metrics.
          </div>
        </div>
      );
    }

    return (
      <div className="card" style={{ marginBottom: '30px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><i className="fas fa-chart-bar"></i> Campaign-Specific Performance Analytics</h3>
          <span className="badge" style={{ background: 'rgba(213,63,140,0.15)', color: 'var(--accent-pink)', border: '1px solid rgba(213,63,140,0.2)' }}>
            Lifetime Conversions
          </span>
        </div>
        <div className="card-body" style={{ padding: '0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '16px 24px' }}>Campaign Name</th>
                <th style={{ padding: '16px' }}>Target Post ID</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Total Comments</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Successful DMs</th>
                <th style={{ padding: '16px', textAlign: 'center' }}>Failed Replies</th>
                <th style={{ padding: '16px 24px' }}>Conversion CTR</th>
              </tr>
            </thead>
            <tbody>
              {analytics.campaigns.map((c) => {
                const totalComm = c.triggerCount || 0;
                const succDMs = c.successCount || 0;
                const errDMs = c.errorCount || 0;
                const conversionRate = totalComm > 0 
                  ? Math.round((succDMs / totalComm) * 100) 
                  : 100;
                
                return (
                  <tr key={c._id || c.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background var(--transition-fast)' }} className="table-row-hover">
                    <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-bullhorn" style={{ color: 'var(--accent-pink)' }}></i>
                        {c.name}
                      </div>
                    </td>
                    <td style={{ padding: '16px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{c.mediaId}</td>
                    <td style={{ padding: '16px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center' }}>{totalComm}</td>
                    <td style={{ padding: '16px', color: '#00e676', fontWeight: '600', textAlign: 'center' }}>{succDMs}</td>
                    <td style={{ padding: '16px', color: errDMs > 0 ? '#ff1744' : 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>{errDMs}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '60px', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${conversionRate}%`, height: '100%', background: 'var(--accent-grad)', borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ fontWeight: '700', color: 'var(--accent-pink)' }}>{conversionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------
  // RENDER: Unauthenticated Setup & Registration / Login
  // ---------------------------------------------------------
  if (!isAuthenticated) {
    if (isRegistering) {
      // RENDER: SaaS Registration (Sign-up)
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '30px', border: '1px solid var(--border-glow)', boxShadow: 'var(--shadow-glow)' }}>
            <div className="brand" style={{ justifyContent: 'center', marginBottom: '30px' }}>
              <div className="brand-logo">
                <i className="fab fa-instagram gradient-icon"></i>
              </div>
              <div className="brand-name">
                <h2>Dmora</h2>
                <span>Create Account</span>
              </div>
            </div>
            
            <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px', textAlign: 'center', fontSize: '1.25rem' }}>Get Started with Dmora</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '25px', lineHeight: 1.45 }}>
              Create your account to automate your Instagram comments and grow your audience.
            </p>

            <form onSubmit={handleRegisterSubmit} className="form-grid">
              <div className="form-group">
                <label htmlFor="reg-name">Your Full Name</label>
                <div className="input-icon">
                  <i className="fas fa-user"></i>
                  <input 
                    type="text" 
                    id="reg-name" 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)} 
                    required 
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <div className="input-icon">
                  <i className="fas fa-envelope"></i>
                  <input 
                    type="email" 
                    id="reg-email" 
                    value={authEmail} 
                    onChange={(e) => setAuthEmail(e.target.value)} 
                    required 
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">Choose Password</label>
                <div className="input-icon">
                  <i className="fas fa-lock"></i>
                  <input 
                    type="password" 
                    id="reg-password" 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label htmlFor="reg-password-confirm">Confirm Password</label>
                <div className="input-icon">
                  <i className="fas fa-lock"></i>
                  <input 
                    type="password" 
                    id="reg-password-confirm" 
                    value={authConfirmPassword} 
                    onChange={(e) => setAuthConfirmPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-gradient btn-full">
                <i className="fas fa-user-plus"></i> Sign Up for Free
              </button>
            </form>

            <p style={{ marginTop: '20px', fontSize: '0.82rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <span 
                style={{ color: 'var(--accent-pink)', cursor: 'pointer', fontWeight: '600' }} 
                onClick={() => setIsRegistering(false)}
              >
                Log in here
              </span>
            </p>
          </div>
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
        </div>
      );
    } else {
      // RENDER: SaaS Login
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '30px', border: '1px solid var(--border-glow)', boxShadow: 'var(--shadow-glow)' }}>
            <div className="brand" style={{ justifyContent: 'center', marginBottom: '30px' }}>
              <div className="brand-logo">
                <i className="fab fa-instagram gradient-icon"></i>
              </div>
              <div className="brand-name">
                <h2>Dmora</h2>
                <span>Portal Access</span>
              </div>
            </div>
            
            <h3 style={{ fontFamily: 'Space Grotesk', marginBottom: '10px', textAlign: 'center', fontSize: '1.25rem' }}>Login to Dashboard</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '25px' }}>
              Enter your credentials to manage your automations.
            </p>

            <form onSubmit={handleLoginSubmit} className="form-grid">
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <div className="input-icon">
                  <i className="fas fa-envelope"></i>
                  <input 
                    type="email" 
                    id="login-email" 
                    value={authEmail} 
                    onChange={(e) => setAuthEmail(e.target.value)} 
                    required 
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label htmlFor="login-password">Password</label>
                <div className="input-icon">
                  <i className="fas fa-lock"></i>
                  <input 
                    type="password" 
                    id="login-password" 
                    value={authPassword} 
                    onChange={(e) => setAuthPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-gradient btn-full">
                <i className="fas fa-sign-in-alt"></i> Access Dashboard
              </button>
            </form>

            <p style={{ marginTop: '20px', fontSize: '0.82rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <span 
                style={{ color: 'var(--accent-pink)', cursor: 'pointer', fontWeight: '600' }} 
                onClick={() => setIsRegistering(true)}
              >
                Sign up here
              </span>
            </p>
          </div>
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
        </div>
      );
    }
  }

  // ---------------------------------------------------------
  // RENDER: Authenticated Dashboard (Main Layout)
  // ---------------------------------------------------------
  return (
    <div className="container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <i className="fab fa-instagram gradient-icon"></i>
          </div>
          <div className="brand-name">
            <h2>Dmora</h2>
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
          
          <button 
            className="nav-item"
            onClick={handleLogout}
            style={{ marginTop: '30px', color: 'var(--color-error)' }}
          >
            <i className="fas fa-sign-out-alt"></i> Log Out
          </button>
        </nav>

        {/* Dynamic SaaS Billing Promotion Widget */}
        {userProfile && (
          <div style={{ marginTop: 'auto', padding: '10px' }}>
            {userProfile.tier === 'pro' && userProfile.subscriptionStatus === 'active' ? (
              // Pro Tier active
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(0, 230, 118, 0.06)',
                border: '1px solid rgba(0, 230, 118, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="fas fa-crown" style={{ color: '#ffb300', fontSize: '1.25rem' }}></i>
                <div>
                  <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)', fontFamily: 'Space Grotesk' }}>PRO Active</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Unlimited campaigns</span>
                </div>
              </div>
            ) : (
              // Free tier - promote upgrade
              <div style={{
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(213, 63, 140, 0.06)',
                border: '1px solid rgba(213, 63, 140, 0.15)'
              }}>
                <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)', marginBottom: '4px', fontFamily: 'Space Grotesk' }}>Free Tier Active</strong>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.3', marginBottom: '10px' }}>
                  Limit of 1 campaign. Upgrade to unlock unlimited automations.
                </p>
                <button 
                  onClick={handleUpgradeSubscription} 
                  className="btn btn-gradient btn-sm btn-full"
                  style={{ padding: '8px', fontSize: '0.78rem', minHeight: 'auto' }}
                >
                  <i className="fas fa-crown"></i> Upgrade to PRO
                </button>
              </div>
            )}
          </div>
        )}

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

            {/* Glowing 7-Day Bot Activity Trend Area Chart */}
            {renderTrendChart()}

            {/* Campaign-Specific Analytics Table */}
            {renderCampaignAnalyticsTable()}

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
                      const isExpanded = !!expandedLogs[log.id || log._id];

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
                                onClick={() => setExpandedLogs(prev => ({ ...prev, [log.id || log._id]: !isExpanded }))}
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
                        <p>Simulated checking will work, but real API calls to Instagram will fail until you connect your Instagram account in Settings.</p>
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
                          
                          {campaignRule && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                              <span>Triggers: <strong>{campaignRule.triggerCount || 0}</strong></span>
                              <span>Sent: <strong style={{ color: '#00e676' }}>{campaignRule.successCount || 0}</strong></span>
                              <span>Failed: <strong style={{ color: campaignRule.errorCount > 0 ? '#ff1744' : 'var(--text-muted)' }}>{campaignRule.errorCount || 0}</strong></span>
                            </div>
                          )}

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
                    <h4><i className="fab fa-facebook-f"></i> Instagram Business Integration</h4>
                    
                    {config.instagramUsername ? (
                      <div className="alert-box alert-success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 20px', marginBottom: '25px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glow)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className="fab fa-instagram gradient-icon" style={{ fontSize: '1.5rem' }}></i>
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.98rem', display: 'block', color: 'var(--text-primary)' }}>Connected Account Active</strong>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Logged in as <a href={`https://instagram.com/${config.instagramUsername}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-pink)', fontWeight: '600' }}>@{config.instagramUsername}</a>
                            </span>
                          </div>
                        </div>
                        <button type="button" onClick={handleDisconnectPage} className="btn btn-secondary btn-sm" style={{ borderColor: 'rgba(255,23,68,0.2)', color: 'var(--color-error)' }}>
                          <i className="fas fa-unlink"></i> Disconnect
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glow)', borderRadius: '12px', marginBottom: '25px' }}>
                        {connectedPages.length === 0 ? (
                          <>
                            <i className="fab fa-facebook-square" style={{ fontSize: '2.8rem', color: '#1877f2', marginBottom: '15px', display: 'block' }}></i>
                            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text-primary)' }}>Link Instagram with Dmora</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 20px auto', lineHeight: 1.45 }}>
                              Connect your Facebook Page linked to your Instagram Professional (Creator/Business) Account to start automating comments and direct messages in Dmora.
                            </p>
                            <button type="button" onClick={handleFacebookConnect} className="btn btn-gradient">
                              <i className="fab fa-facebook-f"></i> Connect Instagram Account
                            </button>
                          </>
                        ) : (
                          <div style={{ textAlign: 'left' }}>
                            <h4 style={{ fontFamily: 'Space Grotesk', fontSize: '1.05rem', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                              <i className="fas fa-tasks" style={{ color: 'var(--accent-pink)' }}></i>
                              Select Connected Instagram Account to Automate:
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {connectedPages.map((page) => (
                                <div key={page.pageId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <i className="fab fa-instagram" style={{ color: 'white', fontSize: '1.1rem' }}></i>
                                    </div>
                                    <div>
                                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>{page.instagramAccount.name}</strong>
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{page.instagramAccount.username} (FB Page: {page.pageName})</span>
                                    </div>
                                  </div>
                                  <button type="button" onClick={() => handleActivatePage(page)} className="btn btn-gradient btn-sm">
                                    <i className="fas fa-check-circle"></i> Activate Bot
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="form-group">
                      <label htmlFor="verifyToken">Webhook Verify Token</label>
                      <input 
                        type="text" 
                        id="verifyToken" 
                        value={config.verifyToken || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, verifyToken: e.target.value }))}
                        required 
                        placeholder="my_secure_verify_token"
                        style={{ background: 'rgba(255,255,255,0.01)', borderStyle: 'dashed' }}
                      />
                      <span className="input-tip">Use this Verify Token in the Webhooks subscription panel inside your Meta Developer Console.</span>
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
                            cardTitle: 'Your Resource is Ready! 🎉',
                            cardSubtitle: 'Click the button below to download.',
                            cardImage: '',
                            cardButtonText: 'Download Now 📥',
                            cardButtonUrl: '',
                            useRichCard: false,
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
                    <button type="submit" className="btn btn-gradient"><i className="fas fa-save"></i> Save Rules</button>
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
