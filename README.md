# Chat Embed Widget

A lightweight, customizable chat widget that supports bot interactions, sales rep handovers, and dynamic theming.

## Quick Setup

### 1. Include the Script
```html
<script src="./chat-embed.js"></script>
```

### 2. Configure the Widget
Add configuration before the script tag:

```html
<script>
window.SimpleChatEmbedConfig = {
    socketUrl: "wss://your-websocket-url.com",
    workflowId: "your-workflow-id",
    title: "Your Chat Title",
    welcomeMessage: "Welcome to our chat!",
    leadCapture: true, // Set to false to skip lead capture form
    theme: {
        primary: '#8349ff',
        headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        // ... other theme options
    }
};
</script>
```

## Configuration Options

### Required Settings
- `socketUrl`: WebSocket server URL
- `workflowId`: Unique identifier for your workflow

### Optional Settings
- `title`: Chat header title (default: "Chat")
- `welcomeMessage`: Initial message displayed to users
- `leadCapture`: Boolean to enable/disable the initial lead capture form (default: `true`)
  - Set to `false` to skip the lead capture form and start chat immediately
    - Creates an **anonymous visitor** with browser metadata
    - Uses a unique browser fingerprint as the visitor identifier
    - No personal information (name, email, phone, zip) is collected or stored
  - Set to `true` to show the form with Name, Email, Phone, and Zip Code fields
    - Creates or updates a visitor record with the provided personal information
    - Associates the conversation with the identified visitor
  - **Note**: Browser metadata is **always collected** for all visitors (both anonymous and identified) and stored in the `metadata.browser_metadata` field

### Theme Customization

#### Message Colors
```javascript
theme: {
    // User messages
    userBubble: '#8349ff',      // Background color
    userText: '#fff',           // Text color
    userAvatar: '#8349ff',      // Avatar background
    
    // Bot messages
    botBubble: '#f8f9fa',       // Background color
    botText: '#2d3748',         // Text color
    botAvatar: '#E4E7FC',       // Avatar background
    
    // Sales rep messages
    salesRepBubble: '#e8f5e8',  // Background color
    salesRepText: '#2d6a2d',    // Text color
    salesRepAvatar: '#e8f5e8',  // Avatar background
    
    // Handover notifications
    handoverNotificationBg: '#E4E7FC',
    handoverNotificationText: '#334155',
    handoverNotificationBorder: '#8349FF'
}
```

#### UI Elements
```javascript
theme: {
    primary: '#8349ff',         // Primary brand color
    headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    background: '#fff',         // Widget background
    border: '#e2e8f0',         // Border color
    inputBg: '#fff',           // Input field background
    sendBtnBg: '#8349ff',      // Send button background
    borderRadius: '1rem',       // Corner roundness
    shadow: '0 10px 30px rgba(0,0,0,0.1)'
}
```

## Features

- ✅ **Auto-reconnect**: Automatically connects using stored session data
- ✅ **Sales Rep Handover**: Seamless transition from bot to human agent
- ✅ **Session Persistence**: Maintains conversation across page refreshes
- ✅ **Dynamic Theming**: Fully customizable colors and styling
- ✅ **Message Types**: Distinct styling for user, bot, and sales rep messages
- ✅ **Reset Function**: Clear messages while preserving session
- ✅ **Optional Lead Capture**: Configurable lead capture form that can be enabled or disabled

## Lead Capture Configuration

The chat widget includes an optional lead capture form that collects user information before starting the chat. This can be controlled via the `leadCapture` configuration option.

### Enabling Lead Capture (Default)
```javascript
window.SimpleChatEmbedConfig = {
    socketUrl: "wss://hub.memox.io",
    workflowId: "your-workflow-id",
    leadCapture: true, // or omit this line for default behavior
    // ... other config
};
```

When enabled, users will see a form requesting:
- Full Name
- Email Address
- Phone Number
- Zip Code

### Disabling Lead Capture
```javascript
window.SimpleChatEmbedConfig = {
    socketUrl: "wss://hub.memox.io",
    workflowId: "your-workflow-id",
    leadCapture: false, // Skip the form
    // ... other config
};
```

When disabled, users can start chatting immediately without filling out any form.

### Browser Metadata Collection

The chat widget **automatically collects browser metadata for ALL visitors**, regardless of whether lead capture is enabled or disabled. This metadata is stored in the `metadata.browser_metadata` field of the Visitor model.

**Browser metadata collected:**
- User Agent (browser and OS information)
- Platform (operating system)
- Language preference
- Screen resolution
- Timezone
- Referrer URL (where the user came from)
- Current page URL
- Cookies enabled status
- Timestamp

### Anonymous Visitors

When `leadCapture` is set to `false`, the chat widget creates an **anonymous visitor** record without collecting personal information.

**Example anonymous visitor record:**
```json
{
  "name": "Anonymous Visitor",
  "email": "anonymous_SGVsbG8gV29ybGQhIFRoaXMgaXM=@memox.local",
  "metadata": {
    "anonymous": true,
    "browser_metadata": {
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "platform": "MacIntel",
      "language": "en-US",
      "screenResolution": "1920x1080",
      "timezone": "America/New_York",
      "referrer": "https://google.com",
      "url": "https://yourwebsite.com/page",
      "cookiesEnabled": true,
      "timestamp": "2025-11-08T14:20:50.000Z"
    }
  }
}
```

**Example identified visitor record (with lead capture):**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone_number": "+1234567890",
  "zip_code": "10001",
  "metadata": {
    "anonymous": false,
    "browser_metadata": {
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "platform": "MacIntel",
      "language": "en-US",
      "screenResolution": "1920x1080",
      "timezone": "America/New_York",
      "referrer": "https://google.com",
      "url": "https://yourwebsite.com/page",
      "cookiesEnabled": true,
      "timestamp": "2025-11-08T14:20:50.000Z"
    }
  }
}
```

### Agent-Based Configuration

If you're using the Memox Hub backend, you can control lead capture through the agent's `config` field:

```json
{
  "lead_capture": false
}
```

The SimpleChatWidget in mmx-unified-chat will automatically fetch this setting and apply it to the chat embed.

## Example Implementation

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <script>
        window.SimpleChatEmbedConfig = {
            socketUrl: "wss://hub.memox.io",
            workflowId: "a2b8ad41-9fb7-40ed-8e5d-d64cbcad8f03",
            title: "Support Chat",
            welcomeMessage: "Hi! How can we help you today?",
            theme: {
                primary: '#ff6b6b',
                userBubble: '#ff6b6b',
                botBubble: '#f1f3f4'
            }
        };
    </script>
    <script src="./chat-embed.js"></script>
</body>
</html>
```

The chat widget will automatically appear in the bottom-right corner of your page.

## Development

### Local Development Server

For local development and testing:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

This will serve the chat embed files on `http://localhost:8080` with CORS enabled.

### Integration with mmx-unified-chat

To use the local version in the mmx-unified-chat project:

1. Start the ChatEmbed_V2 dev server (as shown above)
2. In the mmx-unified-chat project, ensure your `.env` file has:
```
NEXT_PUBLIC_CHAT_EMBED_OVERRIDE=http://localhost:8080/chat-embed.js
```
3. The SimpleChatWidget will automatically use your local version instead of the CDN

### Available Scripts

- `npm run dev` - Start development server on port 8080
- `npm run serve` - Same as dev (alias)
- `npm start` - Same as serve (alias)
