# GitHub Pages + jsDelivr CDN Deployment

## Step 1: Push to GitHub
1. Create a new GitHub repository (if not already done)
2. Push your files to the repository:

```bash
git add .
git commit -m "Chat widget CDN ready"
git push origin main
```

## Step 2: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll to "Pages" section
4. Select "Deploy from a branch"
5. Choose "main" branch and "/ (root)" folder
6. Click "Save"

## Step 3: Access via jsDelivr CDN
Your file will be available at:
```
https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@main/chat-embed.min.js
```

## Usage Example:
```html
<script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@main/chat-embed.min.js"></script>
```

## Benefits:
- ✅ Completely free
- ✅ Global CDN with excellent performance
- ✅ Auto-updates when you push changes
- ✅ HTTPS by default
- ✅ No setup required
