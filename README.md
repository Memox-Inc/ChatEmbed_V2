# Chat Embed Widget

A lightweight, customizable chat widget that supports bot interactions, sales rep handovers, dynamic theming, and product catalog browsing with sorting.

## 🚀 Quick Start (No Web Server Required!)

### Option 1: Open Directly in Browser
1. **Open the HTML file**: Double-click `index.html` or drag it into your browser
2. **Mock data loads automatically** from `products.json`
3. **Test the chat widget** with full product catalog functionality

### Option 2: Local Web Server (Optional)
```bash
# Using Node.js
npx http-server -p 8000

# Using Python
python -m http.server 8000
```

## �️ Product Catalog Features

### Category-Based Browsing
- **7 Product Categories**:
  - 🚚 **1 Trip Containers** - Single-use shipping containers
  - 📦 **Cargo Worthy** - High-quality containers for cargo transport
  - 🛡️ **Wind & Water Tight** - Weather-resistant containers
  - 💰 **Economy Grade** - Budget-friendly container options
  - 🔄 **Multi-Trip** - Reusable containers for multiple shipments
  - 🏢 **Office Containers** - Containers modified for office use
  - 🔧 **Accessories** - Container accessories and modifications

### Advanced Sorting Options
- **Price Sorting**: Low to high, high to low
- **Size Filtering**: 20ft first, 40ft first
- **Name Sorting**: Alphabetical A-Z
- **Delivery Time**: Sort by timeline (5-10 days, Contact, Check availability)
- **Category Badges**: Visual indicators for container size and type

### Navigation Flow
1. **Entry Points** → Click "Browse Products"
2. **Category Selection** → Choose from 7 categories
3. **Filtered Products** → View sorted products with sorting options
4. **Back Navigation** → Return to categories or options

## 🎯 User Experience

- **Intuitive Navigation**: Clear category cards with icons and descriptions
- **Responsive Design**: Works perfectly on mobile and desktop
- **Fast Loading**: Mock data loads instantly without server calls
- **Visual Feedback**: Hover effects, loading states, and smooth transitions
- **Accessibility**: Keyboard navigation and screen reader support

## 🚀 Production Deployment

### Quick Production Setup

1. **Host the Script**: Upload `chat-embed.js` to your CDN or web server
2. **Add Configuration**: Configure via `window.SimpleChatEmbedConfig`
3. **Add Script Tag**: Include the script in your HTML

```html
<!-- Configure the chat embed -->
<script>
window.SimpleChatEmbedConfig = {
    socketUrl: "wss://hub.memox.io",
    workflowId: "a2b8ad41-9fb7-40ed-8e5d-d64cbcad8f03",
    title: "Support Chat",
    welcomeMessage: "Hi! How can we help you today?",
    entryPoints: {
        enabled: true,
        title: "How can we help you?",
        options: [
            {
                id: "get_info",
                label: "Get Information",
                description: "Learn about our services",
                requiresForm: false
            },
            {
                id: "browse_products",
                label: "Browse Products",
                description: "View shipping containers with sorting",
                requiresForm: false
            },
            {
                id: "book_call",
                label: "Book a Call",
                description: "Schedule a consultation",
                requiresForm: true,
                formFields: ["name", "email", "phone", "zip"]
            }
        ]
    },
    theme: {
        primary: '#8349ff',
        headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        userBubble: '#8349ff',
        botBubble: '#f8f9fa',
        userText: '#fff',
        botText: '#2d3748',
        background: '#fff',
        border: '#e2e8f0',
        sendBtnBg: '#8349ff'
    }
};
</script>

<!-- Load the chat embed script -->
<script src="https://your-cdn.com/chat-embed.js"></script>
```

## ✅ Production Features

- **🔧 Standalone**: Zero external dependencies (auto-loads marked.js from CDN)
- **📦 Self-Contained**: IIFE wrapped to avoid global scope pollution
- **🛍️ Product Catalog**: Built-in sorting by price, size, name, and delivery time
- **🔄 Real-time Chat**: WebSocket connections with automatic reconnection
- **📱 Responsive**: Mobile-first design for all screen sizes
- **🎨 Customizable**: Complete theme system with CSS variables
- **🛡️ Secure**: No eval() or dangerous functions, input sanitization
- **⚡ Fast**: Optimized loading with fallback handling

## 📋 Configuration Options

### Required Settings
- `socketUrl`: WebSocket server URL
- `workflowId`: Unique identifier for your workflow

### Entry Points (New Feature)
Control the initial user interaction flow:

```javascript
entryPoints: {
    enabled: true,
    title: "How can we help you?",
    options: [
        {
            id: "get_info",
            label: "Get Information",
            description: "Learn about our services",
            requiresForm: false
        },
        {
            id: "browse_products",
            label: "Browse Products",
            description: "View containers with sorting",
            requiresForm: false
        },
        {
            id: "book_call",
            label: "Book a Call",
            description: "Schedule consultation",
            requiresForm: true,
            formFields: ["name", "email", "phone", "zip"]
        }
    ]
}
```

### Product Catalog Features
- **Price Sorting**: Low to high, high to low
- **Size Filtering**: 20ft first, 40ft first
- **Name Sorting**: Alphabetical A-Z
- **Delivery Time**: Sort by timeline
- **Category Badges**: Visual indicators

### Theme Customization

#### Message Colors
```javascript
theme: {
    // User messages
    userBubble: '#8349ff',
    userText: '#fff',
    userAvatar: '#8349ff',

    // Bot messages
    botBubble: '#f8f9fa',
    botText: '#2d3748',
    botAvatar: '#E4E7FC',

    // Sales rep messages
    salesRepBubble: '#e8f5e8',
    salesRepText: '#2d6a2d',
    salesRepAvatar: '#e8f5e8',

    // Handover notifications
    handoverNotificationBg: '#E4E7FC',
    handoverNotificationText: '#334155',
    handoverNotificationBorder: '#8349FF'
}
```

#### UI Elements
```javascript
theme: {
    primary: '#8349ff',
    headerBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    background: '#fff',
    border: '#e2e8f0',
    inputBg: '#fff',
    sendBtnBg: '#8349ff',
    borderRadius: '1rem',
    shadow: '0 10px 30px rgba(0,0,0,0.1)'
}
```

## 🎯 Production Checklist

- [ ] Upload `chat-embed.js` to your CDN
- [ ] Update `socketUrl` and `workflowId` for your environment
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices
- [ ] Verify WebSocket connections work
- [ ] Test product catalog sorting functionality
- [ ] Confirm form validation works
- [ ] Check theme customization

## 🛠️ Troubleshooting

### CDN Issues
The embed automatically loads `marked.js` from CDN. If CDN fails:
- The chat still works but without markdown formatting
- Check browser console for warnings
- Consider hosting `marked.js` locally if needed

### WebSocket Connection Issues
- Verify `socketUrl` is correct for your environment
- Check firewall settings for WebSocket connections
- The embed includes automatic reconnection logic

### Styling Issues
- Ensure your theme colors are valid CSS color values
- Check for CSS conflicts with your existing styles
- The embed uses specific CSS selectors to avoid conflicts

## 📊 Performance

- **File Size**: ~150KB (minified)
- **Load Time**: < 200ms (cached)
- **Memory Usage**: Minimal footprint
- **Network Requests**: 1-2 (script + optional CDN)

## 🔒 Security

- No `eval()` or dangerous functions
- Input sanitization for XSS prevention
- Secure WebSocket connections
- No external API keys exposed in client code

## Features

- ✅ **Auto-reconnect**: Automatically connects using stored session data
- ✅ **Sales Rep Handover**: Seamless transition from bot to human agent
- ✅ **Session Persistence**: Maintains conversation across page refreshes
- ✅ **Dynamic Theming**: Fully customizable colors and styling
- ✅ **Message Types**: Distinct styling for user, bot, and sales rep messages
- ✅ **Product Catalog**: Browse products with advanced sorting
- ✅ **Entry Points**: Customizable initial interaction flow
- ✅ **Reset Function**: Clear messages while preserving session

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
            entryPoints: {
                enabled: true,
                title: "How can we help you?",
                options: [
                    {
                        id: "browse_products",
                        label: "Browse Products",
                        description: "View our container inventory",
                        requiresForm: false
                    }
                ]
            },
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

---

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
