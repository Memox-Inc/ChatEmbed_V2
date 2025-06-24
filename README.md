# Chat Embed Widget - Dynamic API Configuration

A lightweight, embeddable chat widget with dynamic bot configuration, full conversation tracking, and comprehensive navigation analytics.

## 🚀 Features

- **Dynamic API Configuration**: Fetch bot settings from Django backend using bot ID
- **Conversation Tracking**: Full session and conversation management
- **Navigation Analytics**: Track user behavior, scroll depth, time on site, and interactions
- **Legacy Support**: Backward compatibility with direct API URLs
- **Real-time Messaging**: Support for both AI and human agent handoff
- **File Uploads**: Built-in file upload capabilities
- **Lead Capture**: Optional lead capture forms
- **Responsive Design**: Works on desktop and mobile devices
- **Theme Customization**: Full visual customization support

## 📦 Installation

### Option 1: Dynamic Configuration (Recommended)

```html
<!-- Configure the widget -->
<script>
window.SimpleChatEmbedConfig = {
  botId: "your_bot_id_from_django",           // Required: Bot ID from Django backend
  apiBaseUrl: "https://api.memox.io",         // Optional: Custom API base URL
  djangoBackend: {
    baseUrl: "https://backend.memox.io",      // Django backend URL
    endpoints: {
      botConfig: "/api/v1/bots/{botId}/config",
      conversation: "/api/v1/conversations",
      analytics: "/api/v1/analytics/tracking"
    }
  },
  title: "Support Chat",
  theme: { primary: "#007cba" },
  navigation: {
    enabled: true,
    trackScrollDepth: true,
    trackTimeSpent: true,
    trackInteractions: true
  }
};
</script>

<!-- Load the widget -->
<script src="https://cdn.memox.io/chat-embed.js"></script>
```

### Option 2: Legacy Configuration

```html
<script>
window.SimpleChatEmbedConfig = {
  apiUrl: "https://your-flowise-endpoint.com/api/v1/prediction/abc123",
  title: "Support Chat",
  theme: { primary: "#007cba" }
};
</script>
<script src="https://cdn.memox.io/chat-embed.js"></script>
```

## ⚙️ Configuration Options

### Core Configuration

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| `botId` | string | Bot ID from Django backend (for dynamic config) | Yes* |
| `apiUrl` | string | Direct Flowise URL (for legacy config) | Yes* |
| `apiBaseUrl` | string | Base URL for Memox API endpoints | No |
| `title` | string | Chat window title | No |

*Either `botId` or `apiUrl` is required.

### Django Backend Configuration

```javascript
djangoBackend: {
  baseUrl: "https://backend.memox.io",        // Django backend base URL
  endpoints: {
    botConfig: "/api/v1/bots/{botId}/config", // Bot configuration endpoint
    conversation: "/api/v1/conversations",    // Conversation management
    analytics: "/api/v1/analytics/tracking"  // Analytics tracking
  }
}
```

### Theme Configuration

```javascript
theme: {
  primary: '#007cba',           // Primary brand color
  userBubble: '#e6f0fa',       // User message background
  botBubble: '#f1f1f1',        // Bot message background
  userText: '#22223b',         // User message text color
  botText: '#4a4e69',          // Bot message text color
  background: '#fff',          // Widget background
  border: '#ccc',              // Border colors
  text: '#222',                // Default text color
  width: '100%',               // Widget width
  maxWidth: '350px',           // Maximum width
  minWidth: '220px',           // Minimum width
  borderRadius: '8px',         // Border radius
  fontFamily: 'sans-serif',    // Font family
  zIndex: 9999,                // Z-index
  headerText: '#fff',          // Header text color
  headerBg: 'rgba(34, 34, 59, 0.95)', // Header background
  inputBg: '#fff',             // Input background
  inputText: '#222',           // Input text color
  sendBtnBg: '#007cba',        // Send button background
  sendBtnText: '#fff',         // Send button text color
  sendBtnHover: '#005fa3',     // Send button hover color
  shadow: '0 2px 8px rgba(0,0,0,0.15)' // Box shadow
}
```

### Navigation Tracking Configuration

```javascript
navigation: {
  enabled: true,               // Enable navigation tracking
  trackScrollDepth: true,      // Track scroll behavior
  trackTimeSpent: true,        // Track time on pages
  trackInteractions: true,     // Track user interactions
  maxHistoryPages: 20          // Max pages to store in history
}
```

## 🔧 API Reference

### Widget Methods

```javascript
// Send a message programmatically
window.SimpleChatEmbed.sendMessage("Hello from the parent page!");

// Clear chat history
window.SimpleChatEmbed.clearMessages();

// Get navigation tracking data
const navData = window.SimpleChatEmbed.getNavigationData();

// Get navigation context for API
const navContext = window.SimpleChatEmbed.getNavigationContext();

// Get captured lead data
const leadData = window.SimpleChatEmbed.getLead();

// Get all captured leads
const allLeads = window.SimpleChatEmbed.getLeads();

// Switch to human agent
window.SimpleChatEmbedSwitchToHuman('wss://support.example.com/ws/', 'auth_token');
```

### Navigation Data Structure

```javascript
{
  sessionId: "session_uuid",
  startTime: 1640995200000,
  pages: [
    {
      url: "/homepage",
      title: "Homepage",
      startTime: 1640995200000,
      endTime: 1640995260000,
      timeSpent: 60,
      maxScrollDepth: 85
    }
  ],
  currentPage: {
    url: "/contact",
    title: "Contact Us",
    startTime: 1640995260000,
    maxScrollDepth: 45
  },
  totalTimeOnSite: 120,
  scrollDepth: 45,
  interactions: [
    {
      type: "click",
      element: "button",
      timestamp: 1640995280000,
      data: { buttonText: "Learn More" }
    }
  ]
}
```

## 🌐 Django Backend Integration

### Bot Configuration Endpoint

The widget fetches bot configuration from your Django backend:

```
GET /api/v1/bots/{botId}/config
```

**Expected Response:**
```json
{
  "botId": "bot_123456789",
  "title": "Custom Support Chat",
  "chatEndpoint": "https://your-flowise.com/api/v1/prediction/abc123",
  "theme": {
    "primary": "#007cba",
    "title": "Custom Chat Title"
  },
  "features": {
    "fileUpload": true,
    "leadCapture": true,
    "humanHandoff": true
  }
}
```

### Conversation Management

**Create Conversation:**
```
POST /api/v1/conversations
Content-Type: application/json

{
  "botId": "bot_123456789",
  "sessionId": "session_uuid",
  "navigationContext": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Analytics Tracking

**Send Analytics:**
```
POST /api/v1/analytics/tracking
Content-Type: application/json

{
  "botId": "bot_123456789",
  "conversationId": "conv_uuid",
  "sessionId": "session_uuid",
  "eventType": "message_sent",
  "timestamp": "2024-01-01T00:00:00Z",
  "navigationContext": { ... }
}
```

## 🧪 Testing

The repository includes comprehensive test files:

### Files
- `test-dynamic-api.html` - Tests dynamic API configuration with debug panel
- `test-navigation.html` - Tests navigation tracking features
- `index.html` - Basic demo with both configuration options

### Running Tests
1. Open any test file in a web browser
2. Open browser dev tools to view console logs
3. Use the debug panel to monitor real-time data
4. Test various interactions and navigation patterns

## 🔒 Security

### CORS Configuration
Ensure your Django backend accepts requests from your domain:

```python
CORS_ALLOWED_ORIGINS = [
    "https://yourwebsite.com",
    "https://www.yourwebsite.com",
]
```

### Headers
The widget sends the following headers for verification:
- `X-Widget-Origin`: Origin domain for CORS verification
- `Content-Type: application/json`

## 📋 Migration Guide

### From Legacy to Dynamic Configuration

**Before (Legacy):**
```javascript
window.SimpleChatEmbedConfig = {
  apiUrl: "https://flowise.example.com/api/v1/prediction/abc123",
  title: "Support Chat"
};
```

**After (Dynamic):**
```javascript
window.SimpleChatEmbedConfig = {
  botId: "bot_123456789",
  apiBaseUrl: "https://api.memox.io",
  djangoBackend: {
    baseUrl: "https://backend.memox.io"
  },
  title: "Support Chat" // This can now be set via Django backend
};
```

### Benefits of Migration
- ✅ Centralized bot management via Django admin
- ✅ Full conversation and analytics tracking
- ✅ Dynamic theme and configuration updates
- ✅ Better error handling and fallback options
- ✅ Enhanced navigation context for AI responses

## 🚀 Deployment

### CDN Deployment
1. Upload `chat-embed.js` to your CDN
2. Configure your Django backend endpoints
3. Update widget references to use CDN URL:
   ```html
   <script src="https://cdn.memox.io/chat-embed.js"></script>
   ```

### Self-Hosted Deployment
1. Host `chat-embed.js` on your domain
2. Ensure CORS headers allow widget domain
3. Configure appropriate CSP headers if needed

## 🐛 Troubleshooting

### Common Issues

**Widget not loading:**
- Check browser console for JavaScript errors
- Verify `chat-embed.js` file is accessible
- Ensure configuration is set before loading widget

**API errors:**
- Verify `botId` is correct and exists in Django backend
- Check Django backend CORS configuration
- Confirm all endpoint URLs are correct

**Navigation tracking not working:**
- Ensure `navigation.enabled` is set to `true`
- Check that local storage is available
- Verify no browser extensions are blocking tracking

### Debug Mode
Enable debug mode by opening browser dev tools and checking console logs. The widget provides detailed logging for all API calls and errors.

## 📄 License

This widget is proprietary software owned by Memox Inc. All rights reserved.

## 📞 Support

For technical support and integration assistance:
- Email: support@memox.io
- Documentation: https://docs.memox.io
- Status Page: https://status.memox.io
