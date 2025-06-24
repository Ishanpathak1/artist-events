#!/bin/bash

echo "🚀 Deploying Artist Events Platform to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Build the project first
echo "🏗️  Building project..."
npm run build

# Set required environment variables for Vercel
echo "🔧 Setting up environment variables..."

# Check if .env exists
if [ -f .env ]; then
    echo "📄 Found .env file. Setting environment variables..."
    
    # Extract environment variables and set them in Vercel
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        if [[ $key =~ ^[[:space:]]*# ]] || [[ -z $key ]]; then
            continue
        fi
        
        # Remove quotes from value if present
        value=$(echo "$value" | sed 's/^"//;s/"$//')
        
        echo "Setting $key..."
        vercel env add "$key" production <<< "$value"
    done < .env
else
    echo "⚠️  No .env file found. Please set these environment variables manually in Vercel:"
    echo "   - NEON_DATABASE_URL"
    echo "   - GITHUB_CLIENT_ID"
    echo "   - GITHUB_CLIENT_SECRET"
    echo "   - JWT_SECRET"
    echo "   - SYNC_API_KEY (for cron jobs)"
fi

# Add sync API key if not set
echo "🔑 Setting sync API key for cron jobs..."
SYNC_KEY=$(openssl rand -hex 32)
vercel env add SYNC_API_KEY production <<< "$SYNC_KEY"

echo "📝 Make note of this sync key for manual API calls: $SYNC_KEY"

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "🎯 Your app will be available at the Vercel URL"
echo "🔄 Events will auto-sync every 6 hours via Vercel Cron Jobs"
echo "🎪 Manual sync available at: https://your-domain.vercel.app/api/sync-free-events"
echo ""
echo "🔧 To manually trigger a sync:"
echo "curl -H \"Authorization: Bearer $SYNC_KEY\" https://your-domain.vercel.app/api/sync-free-events" 