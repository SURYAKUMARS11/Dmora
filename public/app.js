// ==========================================================================
// CONFIG & CONSTANTS
// ==========================================================================
let currentConfig = {};
let logPollInterval = null;

// ==========================================================================
// APP INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Load config and logs
    loadConfig();
    loadLogs();
    loadCampaigns();
    
    // Start polling logs every 3 seconds
    startLogPolling();

    // Event Listeners setup
    setupTabs();
    setupConfigForm();
    setupSimulator();
    setupSetupGuide();
    setupPasswordToggle();
    setupMasterToggle();
    setupCampaigns();
    
    // Refresh & Clear log buttons
    document.getElementById('btn-refresh-logs').addEventListener('click', loadLogs);
    document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);
    document.getElementById('btn-reset-config').addEventListener('click', resetConfigToDefault);
});

// ==========================================================================
// NAVIGATION & TABS
// ==========================================================================
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Toggle active classes on nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Toggle active classes on content sections
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });

            // Update header text based on active tab
            if (targetTab === 'dashboard-tab') {
                pageTitle.textContent = 'Dashboard & Logs';
                pageSubtitle.textContent = 'Monitor and test your Instagram interactions in real-time';
            } else if (targetTab === 'campaigns-tab') {
                pageTitle.textContent = 'Campaign Manager';
                pageSubtitle.textContent = 'Set up custom comment-to-DM triggers for individual posts & reels';
            } else if (targetTab === 'settings-tab') {
                pageTitle.textContent = 'Bot Settings';
                pageSubtitle.textContent = 'Configure API keys, reply text templates, and filters';
            } else if (targetTab === 'setup-tab') {
                pageTitle.textContent = 'Setup Guide';
                pageSubtitle.textContent = 'Follow these steps to connect your Instagram Page';
            }
        });
    });
}

// Global function to programmatically switch tabs
window.switchTab = function(tabId) {
    const navItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (navItem) {
        navItem.click();
    }
};

// ==========================================================================
// CONFIGURATION MANAGEMENT
// ==========================================================================
async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        
        currentConfig = await response.json();
        
        // Fill form fields
        document.getElementById('pageAccessToken').value = currentConfig.pageAccessToken || '';
        document.getElementById('verifyToken').value = currentConfig.verifyToken || '';
        document.getElementById('instagramUsername').value = currentConfig.instagramUsername || '';
        document.getElementById('keywords').value = currentConfig.keywords || '';
        document.getElementById('publicReply').value = currentConfig.publicReply || '';
        document.getElementById('privateDM').value = currentConfig.privateDM || '';
        document.getElementById('ignoreReplies').checked = !!currentConfig.ignoreReplies;
        
        // Master toggle sync
        const masterToggle = document.getElementById('master-bot-toggle');
        const badge = document.getElementById('bot-status-badge');
        masterToggle.checked = !!currentConfig.isEnabled;
        
        if (currentConfig.isEnabled) {
            badge.textContent = 'ACTIVE';
            badge.className = 'badge active-badge';
        } else {
            badge.textContent = 'DISABLED';
            badge.className = 'badge disabled-badge';
        }

        // Active keywords stats display
        const keywordsStat = document.getElementById('stat-keywords');
        keywordsStat.textContent = currentConfig.keywords ? currentConfig.keywords.split(',').slice(0, 3).join(', ') + (currentConfig.keywords.split(',').length > 3 ? '...' : '') : 'None';

        // Warning banner in simulation if page token is missing
        const simWarning = document.getElementById('sim-token-warning');
        if (!currentConfig.pageAccessToken) {
            simWarning.classList.remove('hide');
        } else {
            simWarning.classList.add('hide');
        }

    } catch (error) {
        console.error('Error loading configuration:', error);
        showToast('Error loading configuration', 'error');
    }
}

function setupConfigForm() {
    const form = document.getElementById('settings-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            pageAccessToken: document.getElementById('pageAccessToken').value.trim(),
            verifyToken: document.getElementById('verifyToken').value.trim(),
            instagramUsername: document.getElementById('instagramUsername').value.trim(),
            keywords: document.getElementById('keywords').value.trim(),
            publicReply: document.getElementById('publicReply').value.trim(),
            privateDM: document.getElementById('privateDM').value.trim(),
            ignoreReplies: document.getElementById('ignoreReplies').checked,
            isEnabled: document.getElementById('master-bot-toggle').checked
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save config');
            
            const result = await response.json();
            if (result.success) {
                showToast('Configuration saved successfully!', 'success');
                loadConfig(); // Refresh local config mapping
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    });
}

function setupMasterToggle() {
    const masterToggle = document.getElementById('master-bot-toggle');
    masterToggle.addEventListener('change', async () => {
        const isEnabled = masterToggle.checked;
        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled })
            });

            if (!response.ok) throw new Error('Failed to toggle bot status');
            
            const result = await response.json();
            if (result.success) {
                showToast(isEnabled ? 'Instagram bot enabled!' : 'Instagram bot disabled.', isEnabled ? 'success' : 'info');
                loadConfig(); // Sync fields
            }
        } catch (error) {
            masterToggle.checked = !isEnabled; // Revert switch UI on failure
            showToast('Error changing bot status', 'error');
        }
    });
}

function resetConfigToDefault() {
    if (confirm('Are you sure you want to reset all configurations to defaults? This will erase your tokens.')) {
        document.getElementById('pageAccessToken').value = '';
        document.getElementById('verifyToken').value = 'my_secure_verify_token_123';
        document.getElementById('instagramUsername').value = '';
        document.getElementById('keywords').value = 'sent, pdf, link';
        document.getElementById('publicReply').value = 'Sent ✅ Follow me and check your DM.';
        document.getElementById('privateDM').value = 'Hey! Here is the content 👇\n\nhttps://example.com/your-pdf-link';
        document.getElementById('ignoreReplies').checked = true;
        
        // Trigger submit programmatically
        document.getElementById('settings-form').dispatchEvent(new Event('submit'));
    }
}

// Password / Token visibility eye icon toggle
function setupPasswordToggle() {
    const toggleBtn = document.querySelector('.toggle-password-btn');
    const passwordInput = document.getElementById('pageAccessToken');

    toggleBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        
        // Toggle icon class
        const icon = toggleBtn.querySelector('i');
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    });
}

// ==========================================================================
// ACTIVITY LOGGING & STATS
// ==========================================================================
async function loadLogs() {
    try {
        const response = await fetch('/api/logs');
        if (!response.ok) throw new Error('Failed to fetch logs');
        
        const logs = await response.json();
        renderLogs(logs);
        calculateStats(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
    }
}

function renderLogs(logs) {
    const logsContainer = document.getElementById('logs-list');
    
    if (logs.length === 0) {
        logsContainer.innerHTML = `
            <div class="empty-logs">
                <i class="fas fa-history"></i>
                <p>No logs found. Simulate a comment or receive webhooks to start logging.</p>
            </div>
        `;
        return;
    }

    logsContainer.innerHTML = '';
    
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = `log-item log-${log.type}`;
        
        // Format time nicely
        const date = new Date(log.timestamp);
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
                             ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        // Build details toggler if payload detail exists
        let detailsHtml = '';
        if (log.details && Object.keys(log.details).length > 0) {
            const detailId = `detail-${log.id}`;
            const detailStr = JSON.stringify(log.details, null, 2);
            detailsHtml = `
                <button class="log-details-toggle" onclick="toggleLogDetails('${detailId}')">View Details</button>
                <pre id="${detailId}" class="log-details-block hide">${escapeHtml(detailStr)}</pre>
            `;
        }

        let simulatePostbackHtml = '';
        if (log.details && log.details.isFollowGateMock) {
            simulatePostbackHtml = `
                <div style="margin-top: 10px; margin-bottom: 5px;">
                    <button class="btn btn-gradient btn-sm" onclick="triggerMockPostback('${log.details.ruleId}', '${log.details.commentId}', '${log.details.userId}', '${log.details.username}')" style="padding: 4px 10px; font-size: 0.75rem; min-width: auto; cursor: pointer;">
                        <i class="fas fa-sync-alt"></i> Simulate Click: "Try Again 🔄"
                    </button>
                </div>
            `;
        }

        item.innerHTML = `
            <div class="log-meta">
                <div class="log-meta-left">
                    <span class="log-badge">${log.type}</span>
                    <span class="log-time">${formattedTime}</span>
                </div>
            </div>
            <div class="log-message">${escapeHtml(log.message)}</div>
            ${simulatePostbackHtml}
            ${detailsHtml}
        `;
        
        logsContainer.appendChild(item);
    });
}

// Helper to expand/collapse JSON debug fields in logs
window.toggleLogDetails = function(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.toggle('hide');
        const btn = el.previousElementSibling;
        if (el.classList.contains('hide')) {
            btn.textContent = 'View Details';
        } else {
            btn.textContent = 'Hide Details';
        }
    }
};

async function clearLogs() {
    if (confirm('Are you sure you want to clear all execution logs from the server?')) {
        try {
            const response = await fetch('/api/clear-logs', { method: 'POST' });
            if (response.ok) {
                showToast('Logs cleared.', 'info');
                loadLogs();
            }
        } catch (error) {
            showToast('Failed to clear logs', 'error');
        }
    }
}

function calculateStats(logs) {
    // Total triggers (defined as keyword matches)
    const triggersCount = logs.filter(log => log.message.includes('Trigger keyword matched')).length;
    document.getElementById('stat-triggers').textContent = triggersCount;

    // Success rate (calculated by success replies vs errors)
    const successLogsCount = logs.filter(log => log.type === 'success').length;
    const errorLogsCount = logs.filter(log => log.type === 'error').length;
    
    let rate = 100;
    if (successLogsCount + errorLogsCount > 0) {
        rate = Math.round((successLogsCount / (successLogsCount + errorLogsCount)) * 100);
    }
    
    const rateElement = document.getElementById('stat-success-rate');
    rateElement.textContent = `${rate}%`;
    
    // Change rate text color dynamically based on rate
    if (rate >= 90) {
        rateElement.style.color = 'var(--color-success)';
    } else if (rate >= 50) {
        rateElement.style.color = 'var(--color-warning)';
    } else if (successLogsCount + errorLogsCount > 0) {
        rateElement.style.color = 'var(--color-error)';
    } else {
        rateElement.style.color = 'var(--text-primary)';
    }
}

function startLogPolling() {
    if (logPollInterval) clearInterval(logPollInterval);
    logPollInterval = setInterval(loadLogs, 3000);
}

// ==========================================================================
// SIMULATOR PANEL
// ==========================================================================
function setupSimulator() {
    const form = document.getElementById('simulator-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('sim-username').value.trim();
        const text = document.getElementById('sim-comment').value.trim();
        const isReply = document.getElementById('sim-is-reply').checked;
        const mediaId = document.getElementById('sim-media-id').value.trim();

        const payload = {
            username,
            text,
            comment_id: `test_cmt_${Math.floor(Math.random() * 900000000 + 100000000)}`,
            userId: `test_usr_${Math.floor(Math.random() * 900000000 + 100000000)}`
        };

        if (mediaId) {
            payload.mediaId = mediaId;
        }

        if (isReply) {
            payload.parent_id = `test_parent_cmt_${Math.floor(Math.random() * 10000000)}`;
        }

        try {
            showToast('Simulating webhook trigger...', 'info');
            const response = await fetch('/api/test-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Simulation endpoint failed');
            
            const result = await response.json();
            if (result.success) {
                // Instantly refresh logs
                setTimeout(loadLogs, 200);
            }
        } catch (error) {
            console.error('Error running test trigger:', error);
            showToast('Simulation failed to trigger', 'error');
        }
    });
}

// ==========================================================================
// SETUP GUIDE WIZARD
// ==========================================================================
function setupSetupGuide() {
    const indicators = document.querySelectorAll('.step-indicator');
    const nextBtns = document.querySelectorAll('.next-step');
    const prevBtns = document.querySelectorAll('.prev-step');
    const stepDetails = document.querySelectorAll('.step-details');

    function activateStep(stepNum) {
        // Update Indicator Badges
        indicators.forEach(indicator => {
            const step = parseInt(indicator.getAttribute('data-step'));
            indicator.classList.remove('active', 'completed');
            
            if (step === stepNum) {
                indicator.classList.add('active');
            } else if (step < stepNum) {
                indicator.classList.add('completed');
            }
        });

        // Update step panels visibility
        stepDetails.forEach(panel => {
            if (panel.id === `step-${stepNum}-details`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    // Step header click support
    indicators.forEach(indicator => {
        indicator.addEventListener('click', () => {
            const stepNum = parseInt(indicator.getAttribute('data-step'));
            activateStep(stepNum);
        });
    });

    // Next/Prev Buttons
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetStep = parseInt(btn.getAttribute('data-next'));
            activateStep(targetStep);
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetStep = parseInt(btn.getAttribute('data-prev'));
            activateStep(targetStep);
        });
    });
}

// ==========================================================================
// NOTIFICATION SYSTEM (TOAST)
// ==========================================================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    // Clear existing type classes
    toast.className = 'toast';
    
    // Set type-specific icon & boundary borders
    if (type === 'success') {
        toast.classList.add('toast-success');
        toastIcon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
        toast.classList.add('toast-error');
        toastIcon.className = 'fas fa-exclamation-circle';
    } else {
        toast.classList.add('toast-info');
        toastIcon.className = 'fas fa-info-circle';
    }
    
    toastMsg.textContent = message;
    
    // Animate display
    toast.classList.remove('hide');
    
    // Dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.add('hide');
    }, 4000);
}

// ==========================================================================
// STRING ESCAPING UTILITY
// ==========================================================================
function escapeHtml(unsafe) {
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// ==========================================================================
// CAMPAIGNS MANAGEMENT (POST-SPECIFIC AUTOMATIONS)
// ==========================================================================
let currentCampaigns = [];
let currentMediaList = [];

async function loadCampaigns() {
    try {
        const indicator = document.getElementById('media-source-indicator');
        if (indicator) {
            indicator.innerHTML = '<i class="fas fa-sync fa-spin" style="margin-right: 6px;"></i> Loading Campaigns...';
        }

        // 1. Fetch configured campaign rules
        const campaignsRes = await fetch('/api/campaigns');
        if (!campaignsRes.ok) throw new Error('Failed to fetch campaigns');
        currentCampaigns = await campaignsRes.json();

        // 2. Fetch Instagram posts (live or mock fallback)
        if (indicator) {
            indicator.innerHTML = '<i class="fas fa-sync fa-spin" style="margin-right: 6px;"></i> Loading IG Posts...';
        }
        const mediaRes = await fetch('/api/instagram/media');
        if (!mediaRes.ok) throw new Error('Failed to fetch media');
        const mediaResult = await mediaRes.json();
        
        currentMediaList = mediaResult.data || [];

        // 3. Render indicator badge
        if (indicator) {
            if (mediaResult.isMock) {
                indicator.innerHTML = '<span style="color: var(--color-warning); font-size: 0.8rem;"><i class="fas fa-exclamation-circle" style="margin-right: 5px;"></i> Mock Data Mode</span>';
                indicator.style.background = 'rgba(255, 234, 0, 0.05)';
                indicator.style.borderColor = 'rgba(255, 234, 0, 0.2)';
            } else {
                indicator.innerHTML = '<span style="color: var(--color-success); font-size: 0.8rem;"><i class="fas fa-check-circle" style="margin-right: 5px;"></i> Connected to IG</span>';
                indicator.style.background = 'rgba(0, 230, 118, 0.05)';
                indicator.style.borderColor = 'rgba(0, 230, 118, 0.2)';
            }
        }

        // 4. Render posts grid
        renderPostsGrid(currentMediaList, currentCampaigns);

    } catch (error) {
        console.error('Error loading campaigns/media:', error);
        showToast('Error loading media or campaigns', 'error');
        const indicator = document.getElementById('media-source-indicator');
        if (indicator) {
            indicator.innerHTML = '<span style="color: var(--color-error);"><i class="fas fa-times-circle" style="margin-right: 5px;"></i> Connection Failed</span>';
        }
    }
}

function renderPostsGrid(mediaList, campaigns) {
    const gridContainer = document.getElementById('posts-grid-container');
    
    if (mediaList.length === 0) {
        gridContainer.innerHTML = `
            <div class="empty-logs">
                <i class="fas fa-photo-video"></i>
                <p>No Instagram posts found. Make sure your account has uploaded posts or videos.</p>
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = mediaList.map(post => {
        const campaign = campaigns.find(c => c.mediaId === post.id);
        const isAutomated = !!campaign;
        const badgeClass = isAutomated ? 'active-automation' : 'no-automation';
        const badgeText = isAutomated 
            ? (campaign.triggerOnAny 
                ? `<i class="fas fa-robot"></i> Automated (Any comment)` 
                : `<i class="fas fa-robot"></i> Automated (${campaign.keywords})`)
            : 'No Automation';
        
        // Formatting Date
        const date = new Date(post.timestamp);
        const formattedDate = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        
        // Thumbnail source handling
        const imgSrc = post.thumbnail_url || post.media_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop';
        
        return `
            <div class="post-card">
                <div class="post-media-container">
                    <span class="post-badge ${badgeClass}">${badgeText}</span>
                    <img src="${imgSrc}" alt="Instagram Post">
                </div>
                <div class="post-card-content">
                    <div>
                        <p class="post-caption" title="${escapeHtml(post.caption || '')}">${escapeHtml(post.caption || '(No caption)')}</p>
                        <div class="post-date"><i class="far fa-calendar-alt" style="margin-right: 5px;"></i> ${formattedDate}</div>
                    </div>
                    <button onclick="openAutomationModal('${post.id}')" class="btn ${isAutomated ? 'btn-gradient' : 'btn-secondary'}" style="width: 100%; cursor: pointer;">
                        <i class="${isAutomated ? 'fas fa-sliders-h' : 'fas fa-plus'}"></i> ${isAutomated ? 'Edit Automation' : 'Set Automation'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function setupCampaigns() {
    const modal = document.getElementById('campaign-modal');
    const btnClose = document.getElementById('btn-close-campaign-modal');
    const btnCancel = document.getElementById('btn-cancel-campaign');
    const btnDelete = document.getElementById('btn-delete-campaign');
    const form = document.getElementById('campaign-form');
    const checkTriggerOnAny = document.getElementById('campaignTriggerOnAny');
    const keywordsGroup = document.getElementById('campaignKeywordsGroup');
    const checkRequireFollow = document.getElementById('campaignRequireFollow');
    const followFallbackGroup = document.getElementById('campaignFollowFallbackGroup');
    const lblPrivateDM = document.getElementById('lblPrivateDM');

    const closeModal = () => {
        modal.classList.remove('active');
        form.reset();
        document.getElementById('campaignId').value = '';
        document.getElementById('campaignMediaId').value = '';
        keywordsGroup.style.display = 'block'; // reset view
        followFallbackGroup.classList.add('hide'); // hide fallback by default
        lblPrivateDM.textContent = 'Private DM Message'; // reset label
    };

    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);

    // Toggle keywords input based on checkbox status
    checkTriggerOnAny.addEventListener('change', () => {
        if (checkTriggerOnAny.checked) {
            keywordsGroup.style.display = 'none';
        } else {
            keywordsGroup.style.display = 'block';
        }
    });

    // Toggle follow gate fallback input based on checkbox status
    checkRequireFollow.addEventListener('change', () => {
        if (checkRequireFollow.checked) {
            lblPrivateDM.textContent = 'Private DM Message (If Following)';
            followFallbackGroup.classList.remove('hide');
        } else {
            lblPrivateDM.textContent = 'Private DM Message';
            followFallbackGroup.classList.add('hide');
        }
    });

    btnDelete.addEventListener('click', async () => {
        const id = document.getElementById('campaignId').value;
        const name = document.getElementById('campaignName').value;
        if (!id) return;
        
        if (confirm(`Are you sure you want to remove the automation for "${name}"?`)) {
            try {
                const response = await fetch(`/api/campaigns/${id}`, {
                    method: 'DELETE'
                });

                if (!response.ok) throw new Error('Failed to delete campaign');
                
                const result = await response.json();
                if (result.success) {
                    showToast('Automation removed.', 'info');
                    closeModal();
                    loadCampaigns();
                }
            } catch (error) {
                console.error('Error deleting campaign:', error);
                showToast('Error removing automation', 'error');
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            id: document.getElementById('campaignId').value || undefined,
            name: document.getElementById('campaignName').value.trim(),
            mediaId: document.getElementById('campaignMediaId').value.trim(),
            keywords: checkTriggerOnAny.checked ? '' : document.getElementById('campaignKeywords').value.trim(),
            triggerOnAny: checkTriggerOnAny.checked,
            publicReply: document.getElementById('campaignPublicReply').value.trim(),
            privateDM: document.getElementById('campaignPrivateDM').value.trim(),
            requireFollow: checkRequireFollow.checked,
            followFallbackDM: checkRequireFollow.checked ? document.getElementById('campaignFollowFallbackDM').value.trim() : '',
            isEnabled: true
        };

        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to save campaign');
            
            const result = await response.json();
            if (result.success) {
                showToast(payload.id ? 'Automation rules updated!' : 'Automation created successfully!', 'success');
                closeModal();
                loadCampaigns();
            }
        } catch (error) {
            console.error('Error saving campaign:', error);
            showToast('Error saving automation settings', 'error');
        }
    });
}

window.openAutomationModal = function(mediaId) {
    const post = currentMediaList.find(p => p.id === mediaId);
    if (!post) return;

    const campaign = currentCampaigns.find(c => c.mediaId === mediaId);
    
    // Set Post Preview in Modal
    document.getElementById('modal-post-img').src = post.thumbnail_url || post.media_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop';
    document.getElementById('modal-post-caption').textContent = post.caption || '(No caption)';
    
    // Fill Hidden Fields
    document.getElementById('campaignMediaId').value = mediaId;
    
    const btnDelete = document.getElementById('btn-delete-campaign');
    const checkTriggerOnAny = document.getElementById('campaignTriggerOnAny');
    const keywordsGroup = document.getElementById('campaignKeywordsGroup');
    const checkRequireFollow = document.getElementById('campaignRequireFollow');
    const followFallbackGroup = document.getElementById('campaignFollowFallbackGroup');
    const lblPrivateDM = document.getElementById('lblPrivateDM');

    if (campaign) {
        // Edit Existing Automation
        document.getElementById('campaignId').value = campaign.id;
        document.getElementById('campaignName').value = campaign.name;
        document.getElementById('campaignKeywords').value = campaign.keywords || '';
        document.getElementById('campaignPublicReply').value = campaign.publicReply;
        document.getElementById('campaignPrivateDM').value = campaign.privateDM;
        
        checkTriggerOnAny.checked = !!campaign.triggerOnAny;
        keywordsGroup.style.display = campaign.triggerOnAny ? 'none' : 'block';

        checkRequireFollow.checked = !!campaign.requireFollow;
        document.getElementById('campaignFollowFallbackDM').value = campaign.followFallbackDM || '';
        
        if (campaign.requireFollow) {
            lblPrivateDM.textContent = 'Private DM Message (If Following)';
            followFallbackGroup.classList.remove('hide');
        } else {
            lblPrivateDM.textContent = 'Private DM Message';
            followFallbackGroup.classList.add('hide');
        }
        
        document.getElementById('campaign-form-title').innerHTML = '<i class="fas fa-edit"></i> Edit Automation';
        btnDelete.style.display = 'block'; // Show delete button
    } else {
        // Create New Automation
        document.getElementById('campaignId').value = '';
        
        // Generate a clean default name from caption
        const cleanName = post.caption 
            ? post.caption.split('\n')[0].substring(0, 30).trim() + '...' 
            : `Post ${mediaId.substring(0, 6)} Automation`;
            
        document.getElementById('campaignName').value = cleanName;
        
        // Pre-fill default templates for better UX
        document.getElementById('campaignKeywords').value = 'pdf';
        document.getElementById('campaignPublicReply').value = 'Sent! Check your DM 📬';
        document.getElementById('campaignPrivateDM').value = 'Hey! Here is the link you requested: ';
        document.getElementById('campaignFollowFallbackDM').value = 'Hey! Thanks for commenting. Please follow my profile first, then comment again to unlock your resource!';
        
        checkTriggerOnAny.checked = false;
        keywordsGroup.style.display = 'block';

        checkRequireFollow.checked = false;
        followFallbackGroup.classList.add('hide');
        lblPrivateDM.textContent = 'Private DM Message';
        
        document.getElementById('campaign-form-title').innerHTML = '<i class="fas fa-robot"></i> Set Automation';
        btnDelete.style.display = 'none'; // Hide delete button
    }

    // Open Modal
    document.getElementById('campaign-modal').classList.add('active');
};

window.triggerMockPostback = async function(ruleId, commentId, userId, username) {
    try {
        showToast('Simulating "Try Again" button click...', 'info');
        const response = await fetch('/api/test-postback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ruleId, commentId, userId, username })
        });
        
        if (response.ok) {
            // Wait briefly to allow logging to update
            setTimeout(loadLogs, 500);
        } else {
            showToast('Failed to trigger postback simulation', 'error');
        }
    } catch (error) {
        console.error('Error triggering postback simulation:', error);
        showToast('Error sending postback simulation', 'error');
    }
};
