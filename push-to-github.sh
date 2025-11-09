#!/bin/bash
# Commands to push BTC Rotator to GitHub

cd ~/Projects/btc-rotator

# Remove existing remote if any
git remote remove origin 2>/dev/null || true

# Add your GitHub repository (replace with your actual username if different)
git remote add origin git@github.com:prestonppratt/btc-rotator.git

# Set main branch
git branch -M main

# Push to GitHub
git push -u origin main

echo "✅ Successfully pushed to GitHub!"
