# 🚀 Vercel Deployment Guide

This guide will help you deploy your Artist Events platform to Vercel with automatic event syncing.

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally
   ```bash
   npm install -g vercel
   ```
3. **Database**: Your Neon PostgreSQL database should be set up
4. **GitHub OAuth App**: For authentication (if using)

## 🔧 Environment Variables

Set these in your Vercel dashboard or during deployment:

### Required Variables
```
NEON_DATABASE_URL=postgresql://username:password@host/database
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
JWT_SECRET=your_jwt_secret_key
SYNC_API_KEY=your_sync_api_key
```

### Optional Variables
```
NODE_ENV=production
TICKETMASTER_API_KEY=your_ticketmaster_key (when ready)
```

## 🚀 Quick Deployment

### Option 1: Using the Deploy Script
```bash
# Make sure you're in the project root
./scripts/deploy-to-vercel.sh
```

### Option 2: Manual Deployment
```bash
# Build the project
npm run build

# Login to Vercel (first time only)
vercel login

# Deploy
vercel --prod
```

## ⚡ Automatic Event Syncing

Your app is configured for **serverless event syncing** using Vercel Cron Jobs:

### 🔄 Automatic Sync (Every 6 Hours)
- **Endpoint**: `/api/sync-free-events`
- **Schedule**: `0 */6 * * *` (every 6 hours)
- **Source**: NYC Open Data API
- **Authentication**: Bearer token (automatically set)

### 🎯 Manual Sync
You can trigger syncs manually:

```bash
# Replace YOUR_DOMAIN and YOUR_SYNC_KEY
curl -H "Authorization: Bearer YOUR_SYNC_KEY" \
     https://YOUR_DOMAIN.vercel.app/api/sync-free-events
```

## 📊 API Endpoints

After deployment, these endpoints will be available:

### Event Syncing
- `GET /api/sync-free-events` - Sync NYC music events
- `GET /api/sync-events?source=1` - Sync specific source
- `GET /api/sync-events?full=true` - Full system sync

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/validate` - Validate session

### Events
- `GET /events` - Public events page
- `GET /api/events` - Events API
- `POST /api/events` - Create event (admin)

## 🎪 Features After Deployment

✅ **Automatic Event Discovery**: Every 6 hours, new NYC music events are fetched  
✅ **Real-time Updates**: Events are live on your site immediately  
✅ **Duplicate Prevention**: Smart filtering prevents duplicate events  
✅ **Music Focus**: Only music-related events are added  
✅ **Serverless Architecture**: No background processes to manage  
✅ **Admin Dashboard**: Full admin controls at `/admin`  
✅ **User Authentication**: GitHub OAuth integration  

## 🔍 Monitoring & Debugging

### Check Sync Status
Visit your Vercel dashboard → Functions → Cron Jobs to see sync execution logs.

### Manual Testing
```bash
# Test sync endpoint (replace with your domain and key)
curl -H "Authorization: Bearer YOUR_SYNC_KEY" \
     https://your-app.vercel.app/api/sync-free-events

# Expected response:
{
  "success": true,
  "message": "Successfully synced X new music events",
  "events_added": 3,
  "timestamp": "2025-06-24T19:45:00.000Z"
}
```

### View Logs
```bash
# View deployment logs
vercel logs YOUR_DEPLOYMENT_URL

# View function logs
vercel logs YOUR_DEPLOYMENT_URL --since=1h
```

## 🛠️ Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all required variables

2. **Database Connection Issues**
   - Verify `NEON_DATABASE_URL` is correct
   - Check if your Neon database allows connections

3. **Cron Jobs Not Running**
   - Cron jobs require a Pro Vercel plan
   - Alternatively, use a free service like [cron-job.org](https://cron-job.org)

4. **API Authorization Errors**
   - Make sure `SYNC_API_KEY` is set in environment variables
   - Use the same key in your curl requests

### Alternative Sync Solutions

If Vercel Cron doesn't work, set up external cron:

1. **GitHub Actions** (Free)
   ```yaml
   name: Sync Events
   on:
     schedule:
       - cron: '0 */6 * * *'
   jobs:
     sync:
       runs-on: ubuntu-latest
       steps:
         - name: Trigger Sync
           run: |
             curl -H "Authorization: Bearer ${{ secrets.SYNC_API_KEY }}" \
                  https://your-app.vercel.app/api/sync-free-events
   ```

2. **Cron-job.org** (Free)
   - Create account at cron-job.org
   - Set URL: `https://your-app.vercel.app/api/sync-free-events`
   - Add header: `Authorization: Bearer YOUR_SYNC_KEY`
   - Schedule: Every 6 hours

## 🎉 Success!

Once deployed, your Artist Events platform will:
- ✅ Automatically discover new NYC music events
- ✅ Serve them to visitors at `/events`
- ✅ Allow admin management at `/admin`
- ✅ Scale automatically with serverless architecture

Your events will stay fresh and up-to-date without any manual intervention! 