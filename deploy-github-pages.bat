@echo off
echo 🚀 GitHub Pages + jsDelivr CDN Deployment
echo ==========================================
echo.

echo 📋 Current Status:
echo Repository: Memox-Inc/ChatEmbed_V2
echo Branch: cdn-deployment
echo.

echo 📦 Checking files...
if not exist "chat-embed.min.js" (
    echo ❌ chat-embed.min.js not found!
    echo Please ensure the minified file exists.
    pause
    exit /b 1
)

if not exist "cdn-test.html" (
    echo ❌ cdn-test.html not found!
    pause
    exit /b 1
)

echo ✅ All required files found!
echo.

echo 🧪 Step 1: Test Locally First
echo Opening cdn-test.html for local testing...
start cdn-test.html
echo.

echo ⏳ Please test the chat widget locally first.
echo Press any key when ready to deploy to CDN...
pause >nul
echo.

echo 📤 Step 2: Deploying to GitHub...
git add .
git commit -m "Update CDN files for deployment"
git push origin cdn-deployment

echo.
echo ✅ Files pushed to GitHub!
echo.

echo 🌐 Step 3: CDN URLs
echo.
echo Your CDN URLs are:
echo 📍 jsDelivr (Recommended):
echo https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@cdn-deployment/chat-embed.min.js
echo.
echo 📍 GitHub Pages (after enabling):
echo https://memox-inc.github.io/ChatEmbed_V2/chat-embed.min.js
echo.

echo 📝 Step 4: Enable GitHub Pages
echo.
echo Please go to: https://github.com/Memox-Inc/ChatEmbed_V2/settings/pages
echo 1. Source: Deploy from a branch
echo 2. Branch: cdn-deployment
echo 3. Folder: / (root)
echo 4. Click Save
echo.

echo ⏱️ Note: jsDelivr updates in 2-3 minutes, GitHub Pages takes 5-10 minutes
echo.

echo 🧪 Test your CDN with:
echo.
echo ^<script src="https://cdn.jsdelivr.net/gh/Memox-Inc/ChatEmbed_V2@cdn-deployment/chat-embed.min.js"^>^</script^>
echo.

echo 🎉 Deployment Complete!
echo Your chat widget is now available worldwide via CDN!
echo.
pause
