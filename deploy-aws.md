# AWS CloudFront CDN Deployment

## Step 1: Create S3 Bucket
1. Go to AWS S3 Console
2. Create bucket (e.g., "chat-widget-cdn-bucket")
3. Upload `chat-embed.min.js`
4. Make bucket publicly readable

## Step 2: Create CloudFront Distribution
1. Go to CloudFront Console
2. Create distribution
3. Origin domain: your S3 bucket
4. Origin path: (leave empty)
5. Viewer protocol policy: "Redirect HTTP to HTTPS"
6. Allowed HTTP methods: GET, HEAD
7. Create distribution

## Step 3: Configure CORS Headers
Add to S3 bucket policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

## Step 4: Set Response Headers
In CloudFront behavior settings:
```
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=31536000
Content-Type: application/javascript
```

## CDN URL:
```
https://d1234567890abc.cloudfront.net/chat-embed.min.js
```

## Benefits:
- ✅ Enterprise-grade performance
- ✅ Global edge locations
- ✅ Pay-as-you-go pricing
- ✅ Advanced caching controls
- ✅ AWS integration
