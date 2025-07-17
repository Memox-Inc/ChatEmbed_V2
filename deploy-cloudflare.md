# CloudFlare CDN Deployment

## Step 1: Create CloudFlare Account
1. Go to [cloudflare.com](https://cloudflare.com)
2. Sign up for free account

## Step 2: Upload Files
### Option A: Using CloudFlare Pages
1. Go to "Pages" in CloudFlare dashboard
2. Create a new project
3. Connect to your GitHub repository
4. Deploy automatically

### Option B: Using CloudFlare R2 Storage
1. Go to "R2 Object Storage"
2. Create a bucket (e.g., "chat-widget-cdn")
3. Upload `chat-embed.min.js`
4. Make bucket public

## Step 3: Custom Domain
1. Add your domain to CloudFlare
2. Update nameservers
3. Create CNAME record: `cdn.yoursite.com` → `your-bucket.r2.dev`

## CDN URL Examples:
```
https://chat-widget.pages.dev/chat-embed.min.js
# or
https://cdn.yoursite.com/chat-embed.min.js
```

## Benefits:
- ✅ Enterprise-grade CDN
- ✅ Fastest global performance
- ✅ DDoS protection
- ✅ Free tier available
- ✅ Advanced caching options
