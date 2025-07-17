# Netlify CDN Deployment

## Step 1: Create Netlify Account
1. Go to [netlify.com](https://netlify.com)
2. Sign up (free account)
3. Connect your GitHub account

## Step 2: Deploy from GitHub
1. Click "New site from Git"
2. Choose "GitHub"
3. Select your `ChatEmbed_V2` repository
4. Build settings:
   - Build command: (leave empty)
   - Publish directory: (leave empty or put ".")
5. Click "Deploy site"

## Step 3: Custom Domain (Optional)
1. Go to "Domain settings"
2. Add custom domain like `cdn.yourcompany.com`
3. Configure DNS settings

## Step 4: CDN Usage
Your CDN URL will be:
```
https://your-site-name.netlify.app/chat-embed.min.js
```

## Usage Example:
```html
<script src="https://your-site-name.netlify.app/chat-embed.min.js"></script>
```

## Benefits:
- ✅ Free tier available
- ✅ Global CDN
- ✅ Custom domains
- ✅ Auto-deploy on git push
- ✅ HTTPS by default
- ✅ Great performance
