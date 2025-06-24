/**
 * Simple Chat Embed Widget
 * 
 * A lightweight, embeddable chat widget that provides real-time messaging
 * capabilities with AI/human agents. Features include file uploads, message
 * persistence, responsive design, and full theme customization.
 * 
 * Usage:
 * Include this script in your HTML and optionally configure it by setting
 * window.SimpleChatEmbedConfig before loading the script.
 * 
 * Example configuration:
 * window.SimpleChatEmbedConfig = {
 *   apiUrl: "your-api-endpoint",
 *   title: "Support Chat",
 *   theme: { primary: "#007cba" }
 * };
 * 
 * @author Memox Inc
 * @version 1.0
 */
(function () {
  
  // ============================================================================
  // CONFIGURATION & SETUP
  // ============================================================================
  
  /**
   * Default configuration object for the chat widget
   * All these values can be overridden via window.SimpleChatEmbedConfig
   */
  var defaultConfig = {
    // API endpoint for chat functionality
    apiUrl: "https://builder.memox.io/api/v1/prediction/832807e0-6eb1-45ae-ab90-1bc0a18e8487",
    
    // Chat window title displayed in header
    title: 'Chat',
    
    // Theme configuration for visual styling
    theme: {
      primary: '#0078d4',           // Primary brand color
      userBubble: '#e6f0fa',       // User message bubble background
      botBubble: '#f1f1f1',        // Bot message bubble background
      userText: '#22223b',         // User message text color
      botText: '#4a4e69',          // Bot message text color
      background: '#fff',          // Widget background color
      border: '#ccc',              // Border colors
      text: '#222',                // Default text color
      width: '100%',               // Widget width
      maxWidth: '350px',           // Maximum width constraint
      minWidth: '220px',           // Minimum width constraint
      borderRadius: '8px',         // Border radius for rounded corners
      fontFamily: 'sans-serif',    // Font family
      zIndex: 9999,                // Z-index for layering above other content
      headerText: '#fff',          // Header text color
      headerBg: 'rgba(34, 34, 59, 0.95)', // Header background color
      inputBg: '#fff',             // Input field background
      inputText: '#222',           // Input field text color
      sendBtnBg: '#0078d4',        // Send button background
      sendBtnText: '#fff',         // Send button text color      sendBtnHover: '#005fa3',     // Send button hover color
      shadow: '0 2px 8px rgba(0,0,0,0.15)' // Box shadow for depth
    },
    
    // Navigation tracking configuration
    navigation: {
      enabled: true,               // Enable navigation tracking
      trackScrollDepth: true,      // Track how far users scroll on pages
      trackTimeSpent: true,        // Track time spent on each page
      trackInteractions: true,     // Track clicks and user interactions
      maxHistoryPages: 20          // Maximum number of pages to store in history
    }
  };
  
  /**
   * Merge user configuration with defaults
   * This allows users to override specific properties while keeping defaults for others
   * Uses object spread operator for shallow merging with deep merge for theme and navigation objects
   */
  var config = window.SimpleChatEmbedConfig ? {
    ...defaultConfig,
    ...window.SimpleChatEmbedConfig,
    theme: { ...defaultConfig.theme, ...(window.SimpleChatEmbedConfig.theme || {}) },
    navigation: { ...defaultConfig.navigation, ...(window.SimpleChatEmbedConfig.navigation || {}) }
  } : defaultConfig;
  
  // Extract configuration values for easier access throughout the code
  var theme = config.theme;
  var apiUrl = config.apiUrl;
  var welcomeMessage = config.welcomeMessage || null;
  var navigationConfig = config.navigation;

  // ============================================================================
  // NAVIGATION TRACKING SYSTEM
  // ============================================================================
  
  /**
   * Navigation tracking data structure
   * Stores user browsing behavior and session information
   */
  var navigationData = {
    sessionId: null,              // Unique session identifier
    startTime: null,              // Session start timestamp
    pages: [],                    // Array of visited pages with details
    currentPage: null,            // Current page tracking object
    totalTimeOnSite: 0,           // Total time spent across all pages (seconds)
    scrollDepth: 0,               // Maximum scroll depth on current page (percentage)
    interactions: []              // Array of user interaction events
  };

  /**
   * Generate a unique session ID for tracking purposes
   * Uses crypto API for secure random generation, falls back to timestamp method
   * @returns {string} Unique session identifier
   */
  function generateSessionId() {
    try {
      // Use crypto API for secure random ID generation
      return 'session_' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    } catch (e) {
      // Fallback to timestamp-based ID if crypto is unavailable
      return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * Track a page view with detailed information
   * Records page URL, title, timestamp, and user context
   * @param {string} url - Page URL to track
   * @param {string} title - Page title
   */
  function trackPageView(url, title) {
    if (!navigationConfig.enabled) return;
    
    var now = new Date();
    var pageData = {
      url: url,
      title: title || document.title,
      timestamp: now.toISOString(),
      timeSpent: 0,                // Will be updated when user leaves page
      scrollDepth: 0,              // Will be updated as user scrolls
      referrer: document.referrer,  // Previous page
      userAgent: navigator.userAgent.substring(0, 200), // Truncated user agent
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    
    // Update time spent on previous page if exists
    if (navigationData.currentPage) {
      var timeSpent = Math.round((now - new Date(navigationData.currentPage.timestamp)) / 1000);
      navigationData.currentPage.timeSpent = timeSpent;
      navigationData.totalTimeOnSite += timeSpent;
    }
    
    // Set new current page and add to history
    navigationData.currentPage = pageData;
    navigationData.pages.push(pageData);
    
    // Limit stored pages to prevent excessive memory usage
    if (navigationData.pages.length > navigationConfig.maxHistoryPages) {
      navigationData.pages = navigationData.pages.slice(-navigationConfig.maxHistoryPages);
    }
    
    // Reset scroll depth for new page
    navigationData.scrollDepth = 0;
    
    // Save updated navigation data
    saveNavigationData();
  }

  /**
   * Track scroll depth on current page
   * Calculates and stores maximum scroll percentage reached
   */
  function trackScrollDepth() {
    if (!navigationConfig.trackScrollDepth || !navigationData.currentPage) return;
    
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    var winHeight = window.innerHeight;
    var scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
    
    // Ensure scroll percentage is within valid range
    scrollPercent = Math.max(0, Math.min(100, scrollPercent));
    
    // Update maximum scroll depth reached
    if (scrollPercent > navigationData.scrollDepth) {
      navigationData.scrollDepth = scrollPercent;
      navigationData.currentPage.scrollDepth = scrollPercent;
      saveNavigationData();
    }
  }

  /**
   * Track user interactions (clicks, form submissions, etc.)
   * @param {string} type - Type of interaction (click, form, etc.)
   * @param {string} element - Element that was interacted with
   * @param {Object} details - Additional interaction details
   */
  function trackInteraction(type, element, details) {
    if (!navigationConfig.trackInteractions) return;
    
    var interaction = {
      type: type,
      element: element,
      timestamp: new Date().toISOString(),
      page: navigationData.currentPage ? navigationData.currentPage.url : window.location.href,
      details: details || {}
    };
    
    navigationData.interactions.push(interaction);
    
    // Limit stored interactions to prevent excessive memory usage
    if (navigationData.interactions.length > 100) {
      navigationData.interactions = navigationData.interactions.slice(-100);
    }
    
    saveNavigationData();
  }

  /**
   * Handle page leave event
   * Updates time spent on current page before navigation
   */
  function trackPageLeave() {
    if (!navigationData.currentPage) return;
    
    var timeSpent = Math.round((new Date() - new Date(navigationData.currentPage.timestamp)) / 1000);
    navigationData.currentPage.timeSpent = timeSpent;
    navigationData.totalTimeOnSite += timeSpent;
    saveNavigationData();
  }

  /**
   * Save navigation data to localStorage for persistence
   * Handles errors gracefully if localStorage is unavailable
   */
  function saveNavigationData() {
    try {
      localStorage.setItem('chatEmbed_navigation', JSON.stringify(navigationData));
    } catch (e) {
      console.warn('Could not save navigation data:', e);
    }
  }

  /**
   * Load navigation data from localStorage
   * Only loads recent session data (within 24 hours)
   */
  function loadNavigationData() {
    try {
      var saved = localStorage.getItem('chatEmbed_navigation');
      if (saved) {
        var data = JSON.parse(saved);
        // Only load if session is recent (within 24 hours)
        if (data.startTime && (new Date() - new Date(data.startTime)) < 24 * 60 * 60 * 1000) {
          navigationData = { ...navigationData, ...data };
        }
      }
    } catch (e) {
      console.warn('Could not load navigation data:', e);
    }
  }

  /**
   * Get navigation context for chat API
   * Returns relevant navigation data to provide context to chat responses
   * @returns {Object|null} Navigation context object or null if disabled
   */
  function getNavigationContext() {
    if (!navigationConfig.enabled) return null;
    
    return {
      sessionId: navigationData.sessionId,
      totalTimeOnSite: navigationData.totalTimeOnSite,
      pagesVisited: navigationData.pages.length,
      currentPage: navigationData.currentPage ? {
        url: navigationData.currentPage.url,
        title: navigationData.currentPage.title,
        timeSpent: navigationData.currentPage.timeSpent,
        scrollDepth: navigationData.currentPage.scrollDepth
      } : null,
      recentPages: navigationData.pages.slice(-5).map(page => ({
        url: page.url,
        title: page.title,
        timeSpent: page.timeSpent,
        scrollDepth: page.scrollDepth
      })),
      totalInteractions: navigationData.interactions.length,
      lastInteraction: navigationData.interactions.length > 0 ? 
        navigationData.interactions[navigationData.interactions.length - 1] : null
    };
  }

  /**
   * Initialize navigation tracking system
   * Sets up event listeners and starts tracking current page
   */
  function initNavigationTracking() {
    if (!navigationConfig.enabled) return;
    
    // Generate session ID and set start time
    navigationData.sessionId = generateSessionId();
    navigationData.startTime = new Date().toISOString();
    
    // Load existing navigation data from previous session
    loadNavigationData();
    
    // Track initial page view
    trackPageView(window.location.href, document.title);
    
    // Set up scroll depth tracking
    if (navigationConfig.trackScrollDepth) {
      window.addEventListener('scroll', trackScrollDepth, { passive: true });
      // Initial scroll check
      trackScrollDepth();
    }
    
    // Set up interaction tracking
    if (navigationConfig.trackInteractions) {
      // Track clicks on the page
      document.addEventListener('click', function(e) {
        var element = e.target.tagName + (e.target.id ? '#' + e.target.id : '') + 
                     (e.target.className ? '.' + e.target.className.split(' ').join('.') : '');
        trackInteraction('click', element, {
          x: e.clientX,
          y: e.clientY
        });
      }, { passive: true });
      
      // Track form submissions
      document.addEventListener('submit', function(e) {
        var formId = e.target.id || 'unnamed-form';
        trackInteraction('form_submit', 'form#' + formId);
      }, { passive: true });
    }
    
    // Track page unload (user leaving page)
    window.addEventListener('beforeunload', function() {
      trackPageLeave();
    });
    
    // Track page visibility changes (tab switching)
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        trackInteraction('page_hidden', 'document');
      } else {
        trackInteraction('page_visible', 'document');
      }
    });
    
    // Save navigation data periodically (every 30 seconds)
    setInterval(saveNavigationData, 30000);
  }

  // ============================================================================
  // MAIN CHAT CONTAINER SETUP
  // ============================================================================
  
  /**
   * Create the main chat container element
   * This is the primary wrapper that contains all chat UI elements
   */
  var chatContainer = document.createElement('div');
  chatContainer.id = 'simple-chat-embed';
  
  // Apply base positioning and layout styles
  chatContainer.style.position = 'fixed';
  chatContainer.style.bottom = '24px';
  chatContainer.style.right = '24px';
  chatContainer.style.width = theme.width;
  chatContainer.style.maxWidth = theme.maxWidth;
  chatContainer.style.minWidth = theme.minWidth;
  chatContainer.style.background = theme.background;
  chatContainer.style.border = '1px solid ' + theme.border;
  chatContainer.style.borderRadius = '1rem';
  chatContainer.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.15)';
  chatContainer.style.fontFamily = theme.fontFamily + ', Inter, system-ui, sans-serif';
  chatContainer.style.zIndex = theme.zIndex;
  chatContainer.style.color = theme.text;
  chatContainer.style.transition = 'width 0.2s, box-shadow 0.2s';
  chatContainer.style.display = 'flex';
  chatContainer.style.flexDirection = 'column';
  chatContainer.style.height = '60vh';
  chatContainer.style.maxHeight = '80vh';
  chatContainer.style.overflow = 'hidden';

  /**
   * Handle responsive design for mobile devices
   * Adjusts chat container size and position based on screen width
   */
  function setResponsive() {
    if (window.innerWidth < 500) {
      // Mobile layout: full width at bottom
      chatContainer.style.width = '98vw';
      chatContainer.style.right = '1vw';
      chatContainer.style.left = '1vw';
      chatContainer.style.bottom = '0';
      chatContainer.style.borderRadius = '8px 8px 0 0';
      chatContainer.style.minWidth = '0';
    } else {
      // Desktop layout: floating widget in corner
      chatContainer.style.width = theme.width;
      chatContainer.style.right = '20px';
      chatContainer.style.left = '';
      chatContainer.style.bottom = '20px';
      chatContainer.style.borderRadius = theme.borderRadius;
      chatContainer.style.minWidth = theme.minWidth;
    }
  }
  
  // Apply initial responsive settings and listen for window resizes
  setResponsive();
  window.addEventListener('resize', setResponsive);

  // ============================================================================
  // HEADER SECTION
  // ============================================================================
  
  /**
   * Create the chat header with title and controls
   * Contains the chat title and refresh button for clearing conversation
   */
  var header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.background = theme.headerBg || 'rgba(34, 34, 59, 0.95)';
  header.style.color = theme.headerText;
  header.style.padding = '0.75rem 1.25rem';
  header.style.borderTopLeftRadius = '1rem';
  header.style.borderTopRightRadius = '1rem';
  header.style.fontWeight = '600';
  header.style.letterSpacing = '0.01em';
  header.style.fontSize = '1.1rem';
  header.style.boxShadow = '0 1px 0 0 #ececec';

  // Header title element
  var headerTitle = document.createElement('span');
  headerTitle.innerText = config.title;
  header.appendChild(headerTitle);

  /**
   * Create refresh/clear button
   * Allows users to clear their conversation history
   */
  var refreshBtn = document.createElement('button');
  refreshBtn.innerText = '⟳';
  refreshBtn.title = 'Clear chat';
  refreshBtn.style.background = 'transparent';
  refreshBtn.style.color = theme.headerText;
  refreshBtn.style.border = 'none';
  refreshBtn.style.fontSize = '1.2rem';
  refreshBtn.style.cursor = 'pointer';
  refreshBtn.style.marginLeft = '10px';
  refreshBtn.style.transition = 'color 0.15s';
  
  // Add hover effects for better UX
  refreshBtn.onmouseover = function() { refreshBtn.style.color = '#a3a3a3'; };
  refreshBtn.onmouseout = function() { refreshBtn.style.color = theme.headerText; };
  
  // Clear conversation when clicked
  refreshBtn.onclick = function() {
    localStorage.removeItem('simple-chat-messages');
    loadMessages();
  };
  
  header.appendChild(refreshBtn);
  chatContainer.appendChild(header);

  // ============================================================================
  // MESSAGES AREA
  // ============================================================================
  
  /**
   * Create the scrollable messages container
   * This area displays all chat messages between user and bot
   */
  var messages = document.createElement('div');
  messages.style.flex = '1';
  messages.style.overflowY = 'auto';
  messages.style.padding = '1.25rem 1rem';
  messages.style.background = '#f8fafc';
  messages.id = 'chat-messages';
  messages.style.display = 'flex';
  messages.style.flexDirection = 'column';
  messages.style.gap = '0.5rem';
  chatContainer.appendChild(messages);

  // ============================================================================
  // INPUT AREA
  // ============================================================================
  
  /**
   * Create the input container for user messages and file uploads
   * Contains text input, file upload button, and send button
   */
  var inputContainer = document.createElement('div');
  inputContainer.style.display     = 'flex';
  inputContainer.style.flexDirection = 'row';
  inputContainer.style.alignItems  = 'stretch';
  inputContainer.style.borderTop   = '1px solid #ececec';
  inputContainer.style.background  = '#ffffff';
  inputContainer.style.padding     = '0.5rem';
  inputContainer.style.boxSizing   = 'border-box';
  inputContainer.style.gap         = '0';
  inputContainer.style.width       = '100%';
  inputContainer.style.flex        = '0 0 auto';

  // Create the <input> field
  var input = document.createElement('input');
  input.type        = 'text';
  input.placeholder = 'Type a message…';
  input.style.flex        = '1 1 0%';
  input.style.minWidth    = '0';
  input.style.width       = '100%';
  input.style.margin      = '0';
  input.style.height      = '2.5rem';
  input.style.padding     = '0 2.2rem 0 1rem'; // right padding for icon
  input.style.border      = '1px solid #ececec';
  input.style.borderRight = 'none';
  input.style.borderRadius= '0.75rem 0 0 0.75rem';
  input.style.background  = theme.inputBg;
  input.style.color       = theme.inputText;
  input.style.fontSize    = '1rem';
  input.style.boxSizing   = 'border-box';
  input.style.outline     = 'none';
  input.style.transition  = 'border 0.15s ease-in-out';

  // on-focus / on-blur adjustments:
  input.addEventListener('focus', function() {
    input.style.border = '1.5px solid #a3a3a3';
    input.style.borderRight = 'none';
  });
  input.addEventListener('blur', function() {
    input.style.border = '1px solid #ececec';
    input.style.borderRight = 'none';
  });

  // Create the “Send” <button> field
  var sendBtn = document.createElement('button');
  sendBtn.title     = 'Send';
  sendBtn.innerHTML = 
    '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" ' +
    ' xmlns="http://www.w3.org/2000/svg">' +
    '  <path d="M2.5 17.5L17.5 10L2.5 2.5V8.33333L13.3333 10L2.5 11.6667V17.5Z" ' +
    '        fill="currentColor"/>' +
    '</svg>';
  sendBtn.style.flex            = '0 0 auto';
  sendBtn.style.margin          = '0';
  sendBtn.style.height          = '2.5rem';
  sendBtn.style.padding         = '0 1.25rem';
  sendBtn.style.background      = theme.sendBtnBg;
  sendBtn.style.color           = theme.sendBtnText;
  sendBtn.style.border          = '1px solid #ececec';
  sendBtn.style.borderLeft      = 'none';
  sendBtn.style.borderRadius    = '0 0.75rem 0.75rem 0';
  sendBtn.style.cursor          = 'pointer';
  sendBtn.style.fontWeight      = '600';
  sendBtn.style.fontSize        = '1rem';
  sendBtn.style.transition      = 'background 0.15s ease-in-out, color 0.15s ease-in-out';
  sendBtn.style.boxSizing       = 'border-box';
  sendBtn.style.display         = 'flex';
  sendBtn.style.justifyContent  = 'center';
  sendBtn.style.alignItems      = 'center';

  // hover state
  sendBtn.addEventListener('mouseover', function() {
    sendBtn.style.background = theme.sendBtnHover;
  });
  sendBtn.addEventListener('mouseout', function() {
    sendBtn.style.background = theme.sendBtnBg;
  });

  // --- Image upload groundwork ---
  // Place the image upload (clip) button inside the input field, left-aligned
  inputContainer.style.position = 'relative';

  var imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  imageInput.style.display = 'none';

  var imageBtn = document.createElement('button');
  imageBtn.title = 'Send image';
  // Paperclip SVG icon
  imageBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 10.5L13.5 4.5C14.3284 3.67157 15.6716 3.67157 16.5 4.5C17.3284 5.32843 17.3284 6.67157 16.5 7.5L8.5 15.5C6.84315 17.1569 4.15685 17.1569 2.5 15.5C0.843146 13.8431 0.843146 11.1569 2.5 9.5L10.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  imageBtn.style.position = 'absolute';
  imageBtn.style.left = '8px';
  imageBtn.style.top = '50%';
  imageBtn.style.transform = 'translateY(-50%)';
  imageBtn.style.height = '2rem';
  imageBtn.style.width = '2rem';
  imageBtn.style.background = 'transparent';
  imageBtn.style.color = theme.inputText;
  imageBtn.style.border = 'none';
  imageBtn.style.borderRadius = '0.5rem';
  imageBtn.style.cursor = 'pointer';
  imageBtn.style.display = 'flex';
  imageBtn.style.justifyContent = 'center';
  imageBtn.style.alignItems = 'center';
  imageBtn.style.transition = 'background 0.15s, color 0.15s';
  imageBtn.onmouseover = function() { imageBtn.style.background = '#ececec'; };
  imageBtn.onmouseout = function() { imageBtn.style.background = 'transparent'; };
  imageBtn.onclick = function() { imageInput.click(); };
  inputContainer.appendChild(imageBtn);
  inputContainer.appendChild(imageInput);

  // Adjust input padding to make space for the icon
  input.style.paddingLeft = '2.5rem';
  // Add left padding to placeholder text for visual alignment
  input.style.setProperty('text-indent', '1.5rem');

  // Handle image selection
  imageInput.addEventListener('change', function(e) {
    var file = imageInput.files[0];
    if (!file) return;
    // Only allow images up to 5MB
    if (file.size > 5 * 1024 * 1024) {
      saveMessage('Image too large (max 5MB).', 'bot');
      loadMessages();
      return;
    }
    var reader = new FileReader();    reader.onload = function(evt) {
      var dataUrl = evt.target.result;
      
      // Save image as a user message for display purposes
      saveMessage('[Image]', 'user');
      loadMessages();
      
      // Send image to appropriate endpoint (AI or human agent)
      if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
        // Send to human agent via WebSocket
        humanSocket.send(JSON.stringify({
          type: 'image', 
          data: dataUrl, 
          filename: file.name
        }));
      } else {
        // Send to AI endpoint via API
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: dataUrl, 
            filename: file.name 
          })
        })
        .then(res => res.json())
        .then(result => {
          let botMsg = result.text || result.answer || '[Image received]';
          saveMessage(botMsg, 'bot');
          loadMessages();
        })
        .catch(() => {
          saveMessage('Error sending image.', 'bot');
          loadMessages();
        });
      }
    };
    reader.readAsDataURL(file);
    imageInput.value = ''; // Clear input after processing
  });

  // ============================================================================
  // FINALIZE INPUT CONTAINER
  // ============================================================================
  
  // Add input elements to container
  inputContainer.appendChild(input);
  inputContainer.appendChild(sendBtn);
  chatContainer.appendChild(inputContainer);

  /**
   * Create footer with branding
   * Shows "Powered by memox" attribution
   */
  var footer = document.createElement('div');
  footer.style.textAlign = 'center';
  footer.style.fontSize = '0.85rem';
  footer.style.color = '#a3a3a3';
  footer.style.padding = '0.25rem 0 0.75rem 0';
  footer.innerHTML = 'Powered by <a href="https://memox.com" target="_blank" style="color:#4a4e69;text-decoration:none;font-weight:600;">memox</a>';
  chatContainer.appendChild(footer);

  // Add the complete chat container to the page
  document.body.appendChild(chatContainer);

  // ============================================================================
  // API COMMUNICATION & STREAMING
  // ============================================================================

  /**
   * Make streaming API request to chat endpoint
   * Supports both streaming and non-streaming responses
   * @param {Object} data - Request payload to send to API
   * @param {Function} onChunk - Callback function for streaming text chunks
   */
  async function queryStream(data, onChunk) {
    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      }
    );
    
    // Fallback for non-streaming or unsupported browsers
    if (!response.body || !window.ReadableStream) {
      const result = await response.json();
      onChunk(result.text || result.answer || JSON.stringify(result), true);
      return;
    }
    
    // Handle streaming response
    const reader = response.body.getReader();
    let decoder = new TextDecoder();
    let done = false;
    let fullText = '';
    let lastText = '';
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        fullText += chunk;
        
        // Try to parse JSON response and extract text
        let displayText = fullText;
        try {
          const parsed = JSON.parse(fullText);
          if (parsed && typeof parsed.text === 'string') {
            displayText = parsed.text;
          }
        } catch (e) {
          // Not JSON format, use raw text
        }
        
        // Only stream new content to avoid repetition
        if (displayText !== lastText) {
          onChunk(displayText, false);
          lastText = displayText;
        }
      }
    }
    onChunk(lastText, true);
  }

  /**
   * Create animated loading dots for bot typing indicator
   * @returns {HTMLElement} Animated dots element
   */
  function createBouncingDots() {
    var loader = document.createElement('span');
    loader.style.display = 'inline-flex';
    loader.style.alignItems = 'center';
    loader.style.height = '1.5em';
    var dotColor = theme.botText || '#4a4e69';
    loader.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s infinite alternate;"></span>
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s 0.2s infinite alternate;"></span>
      <span style="display:inline-block;width:8px;height:8px;margin:0 2px;background:${dotColor};border-radius:50%;animation:bounce 1s 0.4s infinite alternate;"></span>
    `;
    
    // Add CSS animation if not already present
    if (!document.getElementById('simple-chat-bounce-style')) {
      var style = document.createElement('style');
      style.id = 'simple-chat-bounce-style';
      style.innerHTML = `@keyframes bounce { 0% { transform: translateY(0); } 100% { transform: translateY(-7px); } }`;
      document.head.appendChild(style);
    }
    return loader;
  }

  /**
   * Convert markdown links to HTML links with styling
   * @param {string} text - Text potentially containing markdown links
   * @returns {string} HTML with styled links
   */
  function linkifyAndStyle(text) {
    // Replace markdown links [text](url) with styled <a> tags
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, label, url) {
      return '<a href="' + url + '" target="_blank" style="font-weight:bold;color:' + (theme.botText || '#4a4e69') + ';text-decoration:underline;cursor:pointer;">' + label + '</a>';
    });
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  /**
   * Load and display messages from localStorage
   * Called on widget initialization and after clearing chat
   */
  function loadMessages() {
    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
    messages.innerHTML = '';
    
    for (var i = 0; i < msgs.length; i++) {
      var msg = msgs[i];
      var msgDiv = document.createElement('div');
      msgDiv.style.margin = '0';
      msgDiv.style.padding = '0.75rem 1rem';
      msgDiv.style.borderRadius = '1rem';
      msgDiv.style.maxWidth = '66%';
      msgDiv.style.wordBreak = 'break-word';
      msgDiv.style.display = 'block';
      msgDiv.style.minWidth = 'fit-content';
      msgDiv.style.boxSizing = 'border-box';
      msgDiv.style.fontSize = '0.97rem';
      msgDiv.style.lineHeight = '1.7';
      msgDiv.style.boxShadow = '0 1px 2px 0 #ececec';
      var wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.width = '100%';      if (msg.sender === 'user') {
        // Style user messages (right-aligned, user theme colors)
        msgDiv.style.background = theme.userBubble;
        msgDiv.style.color = theme.userText || '#22223b';
        wrapper.style.justifyContent = 'flex-end';
        msgDiv.innerText = msg.text;
      } else {
        // Style bot messages (left-aligned, bot theme colors)
        msgDiv.style.background = theme.botBubble;
        msgDiv.style.color = theme.botText || '#4a4e69';
        wrapper.style.justifyContent = 'flex-start';
        
        if (msg.text === '' && i === msgs.length - 1) {
          // Show typing indicator for empty message (bot is typing)
          msgDiv.appendChild(createBouncingDots());
        } else if (msg.text === '[Image]' && i > 0 && isImageDataUrl(msgs[i-1].text)) {
          // Display uploaded image
          var img = document.createElement('img');
          img.src = msgs[i-1].text;
          img.style.maxWidth = '180px';
          img.style.maxHeight = '120px';
          img.style.borderRadius = '0.75rem';
          img.style.display = 'block';
          img.style.margin = '0.25rem 0';
          msgDiv.appendChild(img);
        } else {
          // Regular bot message with link formatting
          msgDiv.innerHTML = linkifyAndStyle(msg.text);
        }
      }
      wrapper.appendChild(msgDiv);
      messages.appendChild(wrapper);
    }
    
    // Auto-scroll to bottom to show latest messages
    messages.scrollTop = messages.scrollHeight;
  }

  /**
   * Save a message to localStorage for persistence
   * @param {string} msg - Message text to save
   * @param {string} sender - Either 'user' or 'bot'
   */
  function saveMessage(msg, sender) {
    var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
    msgs.push({ text: msg, sender: sender });
    localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
  }

  /**
   * Animate streaming text by updating word by word
   * Creates a typewriter effect for bot responses
   * @param {number} msgIdx - Index of message to animate
   * @param {string} fullText - Complete text to animate
   */
  function animateTextStream(msgIdx, fullText) {
    var words = fullText.split(/(\s+)/g); // Split while keeping spaces
    var current = '';
    var i = 0;
    
    function step() {
      if (i <= words.length) {
        current = words.slice(0, i).join('');
        
        // Update the message in localStorage
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (msgs[msgIdx] && msgs[msgIdx].sender === 'bot') {
          msgs[msgIdx].text = current;
          localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
          loadMessages();
        }
        i++;
        setTimeout(step, 60); // Adjust typing speed here (60ms between words)
      }
    }
    step();
  }

  // --- Human takeover groundwork ---
  // This flag determines if the chat is currently handled by a human agent (via WebSocket/Django backend)
  var isHumanAgentActive = false;
  // This will hold the WebSocket connection if/when a human agent takes over
  var humanSocket = null;

  /**
   * Call this function to switch the chat from AI to human agent mode.
   * It will close any existing AI session and establish a secure WebSocket connection to your backend.
   *
   * @param {string} wsUrl - The WebSocket URL for your Django backend (e.g. wss://yourdomain.com/ws/support/room_id/)
   * @param {string} authToken - (Optional) A secure token for authenticating the user/session with your backend.
   */
  function switchToHumanAgent(wsUrl, authToken) {
    if (isHumanAgentActive) return; // Already in human mode
    isHumanAgentActive = true;
    // Optionally, show a UI message: "You are now chatting with a human agent."
    saveMessage('You are now chatting with a human agent.', 'bot');
    loadMessages();
    // Close any previous socket
    if (humanSocket) humanSocket.close();
    // --- SECURITY NOTE ---
    // Always use wss:// (secure WebSocket) in production.
    // Pass a secure, short-lived auth token (JWT or similar) to authenticate the user/session.
    // Never expose sensitive credentials in the client code.
    var wsFullUrl = wsUrl;
    if (authToken) {
      // Example: append token as query param (your backend should validate it!)
      wsFullUrl += (wsUrl.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(authToken);
    }
    humanSocket = new WebSocket(wsFullUrl);
    humanSocket.onopen = function() {
      // Optionally notify the backend of the chat history or user info here
      // humanSocket.send(JSON.stringify({type: 'init', history: ...}));
    };
    humanSocket.onmessage = function(event) {
      // Expect messages from the agent as plain text or JSON
      var data = event.data;
      try {
        var parsed = JSON.parse(data);
        if (parsed.text) data = parsed.text;
      } catch (e) {}
      saveMessage(data, 'bot');
      loadMessages();
    };
    humanSocket.onclose = function() {
      // Optionally notify the user
      saveMessage('The human agent has left the chat.', 'bot');
      loadMessages();
      isHumanAgentActive = false;
      humanSocket = null;
    };
    humanSocket.onerror = function(err) {
      saveMessage('Connection error with human agent.', 'bot');
      loadMessages();
    };
  }
  /**
   * Main message sending function
   * Routes messages to either AI or human agent based on current state
   * Includes navigation context in API requests for better responses
   */
  async function sendMessage() {
    var val = input.value.trim();
    if (!val) return;
    
    // Track message sending as user interaction
    trackInteraction('chat_message_sent', 'input', { messageLength: val.length });
    
    // Save user message and clear input
    saveMessage(val, 'user');
    input.value = '';
    loadMessages();
    
    // Route to human agent if active
    if (isHumanAgentActive && humanSocket && humanSocket.readyState === 1) {
      humanSocket.send(val);
      return;
    }
    
    // Show loading indicator for AI response
    saveMessage('', 'bot');
    loadMessages();
    
    // Send to AI endpoint with navigation context
    try {
      // Prepare request data with navigation context
      var requestData = { 
        question: val 
      };
      
      // Include navigation context if tracking is enabled
      var navContext = getNavigationContext();
      if (navContext) {
        requestData.context = {
          navigation: navContext,
          timestamp: new Date().toISOString()
        };
      }
      
      const response = await fetch(
        apiUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestData)
        }
      );
      const result = await response.json();
      let botMsg = result.text || result.answer || JSON.stringify(result);
      
      // Animate the bot response with typewriter effect
      var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      var botIdx = msgs.length - 1;
      animateTextStream(botIdx, botMsg);
    } catch (e) {
      // Handle API errors gracefully
      var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
      if (msgs.length && msgs[msgs.length - 1].sender === 'bot') {
        msgs[msgs.length - 1].text = 'Error contacting bot.';
        localStorage.setItem('simple-chat-messages', JSON.stringify(msgs));
        loadMessages();
      }
    }
  }

  /**
   * Switch to human agent support
   * @param {string} wsUrl - WebSocket URL for human agent
   * @param {string} authToken - Optional authentication token
   */
  function switchToHumanAgent(wsUrl, authToken) {
    connectToHumanAgent(wsUrl, authToken);
  }

  // Expose human agent function globally for external access
  // Example: window.SimpleChatEmbedSwitchToHuman('wss://yourdomain.com/ws/support/room_id/', 'token');
  window.SimpleChatEmbedSwitchToHuman = switchToHumanAgent;

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  // Set up send button and Enter key functionality
  sendBtn.onclick = sendMessage;
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  // ============================================================================
  // LEAD CAPTURE FUNCTIONALITY
  // ============================================================================

  /**
   * Show lead capture form inside chat window
   * Collects user name and email before starting chat
   * @param {Function} onComplete - Callback when form is completed
   */
  function showLeadCaptureInChat(onComplete) {
    messages.innerHTML = '';
    var wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';
    wrapper.style.gap = '1.2rem';

    // Form title
    var title = document.createElement('div');
    title.innerText = 'Enter to Chat';
    title.style.fontWeight = '600';
    title.style.fontSize = '1.2rem';
    title.style.marginBottom = '0.5rem';
    wrapper.appendChild(title);

    // Name input field
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Your name';
    nameInput.style.padding = '0.75rem 1rem';
    nameInput.style.border = '1px solid #ececec';
    nameInput.style.borderRadius = '0.75rem';
    nameInput.style.fontSize = '1rem';
    nameInput.style.width = '100%';
    nameInput.style.maxWidth = '260px';
    wrapper.appendChild(nameInput);

    // Email input field
    var emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Email address';
    emailInput.style.padding = '0.75rem 1rem';
    emailInput.style.border = '1px solid #ececec';
    emailInput.style.borderRadius = '0.75rem';
    emailInput.style.fontSize = '1rem';
    emailInput.style.width = '100%';
    emailInput.style.maxWidth = '260px';
    wrapper.appendChild(emailInput);

    // Email validation error message
    var emailError = document.createElement('div');
    emailError.style.display = 'none';
    emailError.style.color = '#e57373';
    emailError.style.fontSize = '0.95rem';
    emailError.style.fontStyle = 'italic';
    emailError.style.marginTop = '0.25rem';
    emailError.style.marginBottom = '-0.5rem';
    emailError.innerText = 'please enter a valid email address';
    wrapper.appendChild(emailError);

    // Button container
    var btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '0.5rem';
    btnRow.style.width = '100%';
    btnRow.style.justifyContent = 'space-between';
    btnRow.style.maxWidth = '260px';

    /**
     * Create confirm button for submitting lead information
     */
    var confirmBtn = document.createElement('button');
    confirmBtn.innerText = 'Enter Chat';
    confirmBtn.style.background = theme.primary;
    confirmBtn.style.color = '#fff';
    confirmBtn.style.border = 'none';
    confirmBtn.style.borderRadius = '0.75rem';
    confirmBtn.style.padding = '0.75rem 1.25rem';
    confirmBtn.style.cursor = 'pointer';
    confirmBtn.style.fontWeight = '600';
    confirmBtn.style.fontSize = '1rem';
    confirmBtn.style.transition = 'background 0.15s, color 0.15s';
    confirmBtn.style.flex = '1';
    
    // Hover effects for confirm button
    confirmBtn.onmouseover = function() { 
      confirmBtn.style.background = theme.sendBtnHover; 
    };
    confirmBtn.onmouseout = function() { 
      confirmBtn.style.background = theme.primary; 
    };

    /**
     * Handle lead capture form submission
     * Validates email and collects user information
     */
    confirmBtn.onclick = function() {
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      
      // Validate email format
      if (!email || !/\S+@\S+\.\S+/.test(email)) {
        emailError.style.display = 'block';
        return;
      }
      emailError.style.display = 'none';

      // Collect additional user data for analytics
      var userAgent = navigator.userAgent;
      var platform = navigator.platform;
      var url = window.location.href;
      var timestamp = new Date().toISOString();
      var language = navigator.language;
      var referrer = document.referrer;
      
      // Fetch public IP address for geolocation
      fetch('https://api.ipify.org?format=json')
        .then(function(res) { return res.json(); })
        .then(function(ipData) {
          var ip = ipData.ip || '';
          
          // Generate unique user GUID if not exists
          var guid = localStorage.getItem('simple-chat-user-guid');
          if (!guid) {
            guid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
              (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
            localStorage.setItem('simple-chat-user-guid', guid);
          }
          
          var leadData = {
            name: sanitize(nameInput.value),
            email: sanitize(emailInput.value),
            timestamp,
            userAgent,
            platform,
            url,
            language,
            referrer,
            guid,
            ip
          };
          
          // Store lead data locally for later processing
          var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
          leads.push(leadData);
          localStorage.setItem('simple-chat-leads', JSON.stringify(leads));
          
          console.log('Lead captured:', leadData);
          onComplete(leadData);
        });
    };
    
    // Allow Enter key to submit form
    nameInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') confirmBtn.click();
    });
    emailInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') confirmBtn.click();
    });
    
    btnRow.appendChild(confirmBtn);

    /**
     * Create skip button for users who want to chat without providing info
     */
    var skipBtn = document.createElement('button');
    skipBtn.innerText = 'Skip';
    skipBtn.style.background = '#222';
    skipBtn.style.color = '#fff';
    skipBtn.style.border = 'none';
    skipBtn.style.borderRadius = '0.75rem';
    skipBtn.style.padding = '0.75rem 1.25rem';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.fontWeight = '600';
    skipBtn.style.fontSize = '1rem';
    skipBtn.style.transition = 'background 0.15s, color 0.15s';
    
    // Skip button hover effects
    skipBtn.onmouseover = function() { skipBtn.style.background = '#444'; };
    skipBtn.onmouseout = function() { skipBtn.style.background = '#222'; };
    
    skipBtn.onclick = function() {
      messages.innerHTML = '';
      
      // Log skipped lead for analytics
      var leadData = { 
        name: '', 
        email: '', 
        skipped: true, 
        timestamp: new Date().toISOString() 
      };
      var leads = JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
      leads.push(leadData);
      localStorage.setItem('simple-chat-leads', JSON.stringify(leads));
      
      console.log('Lead skipped:', leadData);
      onComplete(null);
    };
    
    btnRow.appendChild(skipBtn);
    wrapper.appendChild(btnRow);
    messages.appendChild(wrapper);
    nameInput.focus();

    // Add privacy policy notice
    var privacy = document.createElement('div');
    privacy.style.fontSize = '0.85rem';
    privacy.style.color = '#888';
    privacy.style.textAlign = 'center';
    privacy.style.maxWidth = '260px';
    privacy.style.marginTop = '0.5rem';
    privacy.innerHTML = 'By continuing, you agree to our <a href="https://memox.com/privacy" target="_blank" style="color:#4a4e69;text-decoration:underline;">Privacy Policy</a>.';
    wrapper.appendChild(privacy);
  }

  /**
   * Simple text sanitization function
   * Prevents XSS by encoding HTML entities
   * @param {string} str - String to sanitize
   * @returns {string} Sanitized string
   */
  function sanitize(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================================
  // INITIALIZATION & LEAD CAPTURE FLOW
  // ============================================================================

  /**
   * Check if lead capture should be shown
   * Shows lead form on first visit, regular chat afterwards
   */
  function maybeShowLeadCapture() {
    if (!window.__simpleChatEmbedLeadCaptured) {
      // First time visitor - show lead capture form
      inputContainer.style.display = 'none';
      footer.style.display = 'none';
      
      showLeadCaptureInChat(function(lead) {
        window.__simpleChatEmbedLeadCaptured = true;
        if (lead) {
          window.SimpleChatEmbedLead = lead;
        }
        
        // Restore normal chat interface after lead capture
        restoreChatInterface();
        
        // Show welcome message if configured and no previous messages
        var msgs = JSON.parse(localStorage.getItem('simple-chat-messages') || '[]');
        if (welcomeMessage && msgs.length === 0) {
          saveMessage(welcomeMessage, 'bot');
        }
        loadMessages();
      });
    } else {
      // Returning visitor - show normal chat interface
      restoreChatInterface();
      loadMessages();
    }
  }

  /**
   * Restore the chat interface to its normal state
   * Called after lead capture is complete or skipped
   */
  function restoreChatInterface() {
    inputContainer.style.display = 'flex';
    inputContainer.style.flexDirection = 'row';
    inputContainer.style.width = '100%';
    inputContainer.style.boxSizing = 'border-box';
    inputContainer.style.padding = '0.5rem';
    inputContainer.style.gap = '0';
    inputContainer.style.alignItems = 'stretch';
    inputContainer.style.flex = '0 0 auto';
    inputContainer.style.borderTop = '1px solid #ececec';
    inputContainer.style.background = '#ffffff';
    
    input.style.flex = '1 1 0%';
    input.style.minWidth = '0';
    input.style.width = 'auto';
    input.style.margin = '0';
    input.style.height = '2.5rem';
    input.style.padding = '0 1rem';
    input.style.border = '1px solid #ececec';
    input.style.borderRight = 'none';
    input.style.borderRadius = '0.75rem 0 0 0.75rem';
    input.style.background = theme.inputBg;
    input.style.color = theme.inputText;
    input.style.fontSize = '1rem';
    input.style.boxSizing = 'border-box';
    input.style.outline = 'none';
    input.style.transition = 'border 0.15s ease-in-out';
    
    sendBtn.style.flex = '0 0 auto';
    sendBtn.style.margin = '0';
    sendBtn.style.height = '2.5rem';
    sendBtn.style.padding = '0 1.25rem';
    sendBtn.style.background = theme.sendBtnBg;
    sendBtn.style.color = theme.sendBtnText;
    sendBtn.style.border = '1px solid #ececec';
    sendBtn.style.borderLeft = 'none';
    sendBtn.style.borderRadius = '0 0.75rem 0.75rem 0';
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.fontWeight = '600';
    sendBtn.style.fontSize = '1rem';
    sendBtn.style.transition = 'background 0.15s ease-in-out, color 0.15s ease-in-out';
    sendBtn.style.boxSizing = 'border-box';
    sendBtn.style.display = 'flex';
    sendBtn.style.justifyContent = 'center';
    sendBtn.style.alignItems = 'center';
  }

  // ============================================================================
  // WIDGET INITIALIZATION
  // ============================================================================
  /**
   * Initialize the chat widget
   * Sets up the interface, navigation tracking, and shows appropriate view based on user state
   */
  function initializeWidget() {
    // Initialize navigation tracking system first
    initNavigationTracking();
    
    // Track widget initialization as an interaction
    trackInteraction('chat_widget_initialized', 'widget');
    
    // Load existing messages from storage
    loadMessages();
    
    // Show lead capture or normal chat interface
    maybeShowLeadCapture();
  }

  // Start the widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWidget);
  } else {
    initializeWidget();
  }

  // ============================================================================
  // GLOBAL API EXPOSURE
  // ============================================================================
  /**
   * Expose widget functions globally for external integration
   * Allows parent websites to interact with the chat widget programmatically
   */
  window.SimpleChatEmbed = {
    // Send a message programmatically
    sendMessage: function(text) {
      if (text) {
        input.value = text;
        sendMessage();
      }
    },
    
    // Clear chat history
    clearMessages: function() {
      localStorage.removeItem('simple-chat-messages');
      loadMessages();
    },
    
    // Get current lead data
    getLead: function() {
      return window.SimpleChatEmbedLead || null;
    },
    
    // Get all captured leads
    getLeads: function() {
      return JSON.parse(localStorage.getItem('simple-chat-leads') || '[]');
    },
    
    // Get navigation tracking data
    getNavigationData: function() {
      return navigationData;
    },
    
    // Get navigation context for API
    getNavigationContext: function() {
      return getNavigationContext();
    },
    
    // Clear navigation data
    clearNavigationData: function() {
      localStorage.removeItem('chatEmbed_navigation');
      navigationData = {
        sessionId: null,
        startTime: null,
        pages: [],
        currentPage: null,
        totalTimeOnSite: 0,
        scrollDepth: 0,
        interactions: []
      };
    },
    
    // Switch to human agent
    connectToHuman: switchToHumanAgent,
    
    // Show/hide widget (if you add minimization functionality)
    show: function() {
      chatContainer.style.display = 'flex';
      trackInteraction('chat_widget_opened', 'widget');
    },
    
    hide: function() {
      chatContainer.style.display = 'none';
      trackInteraction('chat_widget_closed', 'widget');
    }
  };

})();
