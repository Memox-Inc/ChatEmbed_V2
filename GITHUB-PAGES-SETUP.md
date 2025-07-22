# 🚀 GitHub Pages + jsDelivr Setup Guide

## Current Repository: Memox-Inc/ChatEmbed_V2
## Current Branch: cdn-deployment

---

## ✅ Step 1: Test Locally First

1. Open `cdn-test.html` in your browser
2. Verify the chat widget appears and works
3. Test the custom purple theme

---

## 🌐 Step 2: Enable GitHub Pages

### Option A: Enable for cdn-deployment branch (Testing)
1. Go to: https://github.com/Memox-Inc/ChatEmbed_V2/settings/pages
2. Source: **Deploy from a branch**
3. Branch: **cdn-deployment**
4. Folder: **/ (root)**
5. Click **Save**

### Option B: Enable for main branch (Production) - Later
*Only after you're satisfied with testing and merge to main*

---

## 📍 Your CDN URLs

### For Testing (cdn-deployment branch):
```html
<!-- jsDelivr CDN (Updates immediately) -->
<script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@cdn-deployment/chat-embed.min.js"></script>

<!-- GitHub Pages (Takes 5-10 minutes to update) -->
<script src="https://memox-inc.github.io/ChatEmbed_V2/chat-embed.min.js"></script>
```

### For Production (main branch) - After merge:
```html
<!-- jsDelivr CDN (Recommended) -->
<script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@main/chat-embed.min.js"></script>

<!-- Latest version (auto-updates) -->
<script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2/chat-embed.min.js"></script>
```

---

## 🧪 Testing Your CDN

### Test CDN Branch URL:
1. Wait 2-3 minutes after pushing to GitHub
2. Test this URL: https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@cdn-deployment/chat-embed.min.js
3. Create a simple test HTML file:

```html
<!DOCTYPE html>
<html>
<head><title>CDN Test</title></head>
<body>
    <h1>CDN Test Page</h1>
    <script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@cdn-deployment/chat-embed.min.js"></script>
</body>
</html>
```

---

## 🔄 Workflow

1. **Development**: Work in `cdn-deployment` branch
2. **Testing**: Use `@cdn-deployment` URLs for testing
3. **Production**: Merge to `main` and use `@main` URLs
4. **Updates**: Push to respective branch, CDN updates automatically

---

## ⚡ Performance Benefits

- **Global CDN**: jsDelivr has 100+ edge locations worldwide
- **HTTP/2**: Faster loading with multiplexing
- **Compression**: Automatic gzip/brotli compression  
- **Caching**: 1-year cache with instant purging on updates
- **Free**: No bandwidth limits or costs

---

## 🎯 Next Steps

1. ✅ Test `cdn-test.html` locally
2. 🌐 Enable GitHub Pages for cdn-deployment branch
3. 🧪 Test CDN URLs
4. 📝 Create documentation for users
5. 🚀 When ready, merge to main for production

---

## 📞 Support URLs

Your widget will be available at:
- **jsDelivr**: https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@main/chat-embed.min.js
- **GitHub Pages**: https://memox-inc.github.io/ChatEmbed_V2/chat-embed.min.js

Anyone can now embed your chat widget with just one line of code! 🎉
