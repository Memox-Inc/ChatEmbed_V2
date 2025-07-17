@echo off
echo 🚀 Deploying Chat Widget to CDN...

REM Check if git is initialized
if not exist ".git" (
    echo Initializing git repository...
    git init
    git branch -M main
)

REM Add all files
echo 📦 Adding files...
git add .

REM Commit changes
echo 💾 Committing changes...
git commit -m "Deploy chat widget to CDN - %date% %time%"

REM Check if remote exists
git remote | findstr origin >nul
if errorlevel 1 (
    echo ❌ No remote 'origin' found!
    echo Please add your GitHub repository as origin:
    echo git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
    pause
    exit /b 1
)

REM Push to GitHub
echo 🌐 Pushing to GitHub...
git push origin main

echo.
echo ✅ Deployment complete!
echo.
echo Your CDN URLs will be available at:
echo 📍 jsDelivr: https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/chat-embed.min.js
echo 📍 GitHub Pages: https://YOUR_USERNAME.github.io/YOUR_REPO/chat-embed.min.js
echo.
echo Usage example:
echo ^<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/chat-embed.min.js"^>^</script^>
echo.
echo Note: It may take a few minutes for jsDelivr to update the cache.
pause
