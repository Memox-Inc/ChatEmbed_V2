#!/bin/bash

# Simple deployment script for GitHub Pages + jsDelivr

echo "🚀 Deploying Chat Widget to CDN..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📦 Adding files..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy chat widget to CDN - $(date)"

# Check if remote exists
if ! git remote | grep -q origin; then
    echo "❌ No remote 'origin' found!"
    echo "Please add your GitHub repository as origin:"
    echo "git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    exit 1
fi

# Push to GitHub
echo "🌐 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your CDN URLs:"
echo "📍 jsDelivr: https://cdn.jsdelivr.net/gh/$(git remote get-url origin | sed 's/.*github.com[:/]\([^/]*\/[^/]*\).git/\1/')@main/chat-embed.min.js"
echo "📍 GitHub Pages: https://$(git remote get-url origin | sed 's/.*github.com[:/]\([^/]*\)\/\([^/]*\).git/\1.github.io\/\2/')/chat-embed.min.js"
echo ""
echo "Usage example:"
echo '<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/YOUR_REPO@main/chat-embed.min.js"></script>'
echo ""
echo "Note: It may take a few minutes for jsDelivr to update the cache."
