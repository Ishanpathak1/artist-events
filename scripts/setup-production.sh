#!/bin/bash

# 🚀 Artist Events Platform - Production Setup Script
# This script helps you deploy to production quickly

echo "🎵 Artist Events Platform - Production Setup"
echo "============================================="
echo ""

# Check if NEON_DATABASE_URL is set
if [ -z "$NEON_DATABASE_URL" ]; then
    echo "❌ NEON_DATABASE_URL environment variable is not set!"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to https://neon.tech and create a free account"
    echo "2. Create a new PostgreSQL project"
    echo "3. Copy your connection string"
    echo "4. Run: export NEON_DATABASE_URL=\"your-connection-string\""
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✅ Found NEON_DATABASE_URL"
echo ""

# Test database connection
echo "🔗 Testing database connection..."
node -e "
import('./lib/database.js').then(db => {
  return db.query('SELECT NOW() as current_time');
}).then(result => {
  console.log('✅ Database connection successful!');
  console.log('🕐 Server time:', result.rows[0].current_time);
}).catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
" || exit 1

echo ""

# Deploy schema and data
echo "📦 Deploying database schema and migrating data..."
node database/deploy-to-neon.js || exit 1

echo ""

# Build the application
echo "🔨 Building application for production..."
npm run build || exit 1

echo ""
echo "🎉 Production setup complete!"
echo ""
echo "Next steps:"
echo "1. Install Vercel CLI: npm install -g vercel"
echo "2. Login to Vercel: vercel login"
echo "3. Deploy: vercel --prod"
echo "4. Add environment variable in Vercel dashboard:"
echo "   NEON_DATABASE_URL=\"$NEON_DATABASE_URL\""
echo ""
echo "Your Artist Events platform is ready to go live! 🚀" 