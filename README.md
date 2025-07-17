# Chat Widget CDN

A simple, embeddable chat widget that anyone can add to their website with just one script tag.

## 🚀 Quick Start

```html
<script src="https://your-cdn.com/chat-embed.min.js"></script>
```

That's it! The chat widget will appear in the bottom-right corner of any website.

## ⚙️ Configuration

Customize the widget by setting `SimpleChatEmbedConfig` before loading the script:

```html
<script>
window.SimpleChatEmbedConfig = {
  apiUrl: "https://your-api.com/chat",
  title: "Help & Support",
  welcomeMessage: "Hi! How can I help you today?",
  theme: {
    primary: "#7c3aed",
    userBubble: "#ede9fe",
    botBubble: "#f3f4f6"
  }
};
</script>
<script src="https://your-cdn.com/chat-embed.min.js"></script>
```

## 📁 Files

- `chat-embed.js` - Original development version
- `chat-embed.min.js` - Minified CDN-ready version
- `demo.html` - Complete demo page with examples
- `index.html` - Basic test page

## 🎨 Theme Options

```javascript
theme: {
  primary: "#0078d4",           // Primary brand color
  userBubble: "#e6f0fa",        // User message background
  botBubble: "#f1f1f1",         // Bot message background
  userText: "#22223b",          // User text color
  botText: "#4a4e69",           // Bot text color
  background: "#fff",           // Widget background
  headerBg: "rgba(34, 34, 59, 0.95)", // Header background
  width: "100%",                // Widget width
  maxWidth: "350px",            // Maximum width
  borderRadius: "8px",          // Border radius
  fontFamily: "sans-serif",     // Font family
  zIndex: 9999                  // Z-index
}
```

## 📱 Features

- ✅ **Responsive design** - Works on desktop and mobile
- ✅ **Image uploads** - Users can send images (max 5MB)
- ✅ **Real-time streaming** - Word-by-word AI responses
- ✅ **Message persistence** - Chat history saved locally
- ✅ **Human handoff** - Switch to live agents via WebSocket
- ✅ **Lead capture** - Built-in contact form
- ✅ **Markdown links** - Support for [text](url) format
- ✅ **No dependencies** - Pure vanilla JavaScript
- ✅ **Easy styling** - Complete theme customization

## 🔧 API Integration

Your API should accept POST requests with this format:

```javascript
// Request body
{
  "question": "User's message text",
  "image": "base64-data-url", // For image uploads
  "filename": "image.jpg"     // Original filename
}

// Expected response
{
  "text": "Bot response text",
  // or
  "answer": "Alternative response field"
}
```

## 🚀 Human Agent Handoff

Switch to human agent mode programmatically:

```javascript
window.SimpleChatEmbedSwitchToHuman(
  'wss://your-backend.com/ws/support/room123/',
  'secure-auth-token'
);
```

## 📊 Lead Capture

The built-in lead capture form automatically collects:
- Name and email
- Browser info (user agent, language)
- Page URL and referrer
- IP address
- Unique user GUID

Access captured data via `window.SimpleChatEmbedLead`

## 🌐 CDN Deployment

1. Upload `chat-embed.min.js` to your CDN
2. Enable CORS headers:
   ```
   Access-Control-Allow-Origin: *
   Cache-Control: public, max-age=31536000
   Content-Type: application/javascript
   ```
3. Use HTTPS for security

## 📝 Usage Examples

### Basic Usage
```html
<script src="https://your-cdn.com/chat-embed.min.js"></script>
```

### Custom Branding
```html
<script>
window.SimpleChatEmbedConfig = {
  title: "Acme Support",
  theme: { primary: "#ff6b35" }
};
</script>
<script src="https://your-cdn.com/chat-embed.min.js"></script>
```

### With Custom API
```html
<script>
window.SimpleChatEmbedConfig = {
  apiUrl: "https://api.yourcompany.com/chat",
  welcomeMessage: "Hello! How can we help you today?"
};
</script>
<script src="https://your-cdn.com/chat-embed.min.js"></script>
```

## 🔒 Security

- Input sanitization to prevent XSS
- Secure WebSocket connections (WSS) for human agents
- Privacy policy compliance
- CORS-enabled for cross-origin usage

## 📄 License

MIT License - Feel free to use in any project!

---

**Made with ❤️ by Memox** - [https://memox.com](https://memox.com)
