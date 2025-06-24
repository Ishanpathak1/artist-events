# 🚀 Deployment Guide - Artist Events Platform

This guide will help you deploy your Artist Events platform to production using **Neon PostgreSQL** (free database hosting) and **Vercel** (free application hosting).

## 📋 Step 1: Set Up Neon Database (Free)

### Create Your Free Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub, Google, or email
3. Create a new project:
   - **Project Name**: `artist-events`
   - **PostgreSQL Version**: 16 (recommended)
   - **Region**: Choose closest to your users

### Get Your Database Connection String
After creating the project, you'll get a connection string like:
```
postgresql://username:password@ep-example.us-east-2.aws.neon.tech/dbname?sslmode=require
```

**Save this connection string** - you'll need it in the next steps.

## 📋 Step 2: Deploy Schema to Neon

### Set Your Database URL
```bash
export NEON_DATABASE_URL="postgresql://username:password@ep-example.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

### Deploy Schema and Data
```bash
# Deploy schema and migrate existing events
node database/deploy-to-neon.js
```

This will:
- ✅ Create all 15 database tables
- ✅ Set up indexes and triggers
- ✅ Migrate your existing events from JSON
- ✅ Insert sample event sources

## 📋 Step 3: Deploy to Vercel (Free)

### Install Vercel CLI
```bash
npm install -g vercel
```

### Configure Environment Variables
Create a `.env.production` file:
```env
# Neon Database
NEON_DATABASE_URL=postgresql://username:password@ep-example.us-east-2.aws.neon.tech/dbname?sslmode=require
NODE_ENV=production

# Optional: Analytics and monitoring
# ANALYTICS_ID=your_analytics_id
```

### Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel --prod

# Set environment variables in Vercel dashboard
vercel env add NEON_DATABASE_URL
# Paste your connection string when prompted
```

### Add Vercel Adapter
Update `astro.config.mjs`:
```javascript
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // ... other config
});
```

Install the adapter:
```bash
npm install @astrojs/vercel
```

Redeploy:
```bash
vercel --prod
```

## 📋 Step 4: Configure Domain (Optional)

### Using Vercel Domain
Your app will be available at: `https://your-project-name.vercel.app`

### Using Custom Domain
1. Go to Vercel dashboard → Your project → Domains
2. Add your custom domain
3. Configure DNS records as instructed

## 🔧 Environment Variables Reference

### Required for Production
```env
NEON_DATABASE_URL=postgresql://...
NODE_ENV=production
```

### Optional
```env
DATABASE_URL=postgresql://...  # Alternative to NEON_DATABASE_URL
DB_HOST=hostname               # If not using connection string
DB_PORT=5432
DB_NAME=dbname
DB_USER=username
DB_PASSWORD=password
```

## 🎯 Alternative Hosting Options

### Option 2: Netlify + Neon
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist

# Add environment variables in Netlify dashboard
```

### Option 3: Railway + Built-in PostgreSQL
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy (includes free PostgreSQL)
railway login
railway deploy
```

## 📊 Free Tier Limits

### Neon Free Tier
- ✅ **Storage**: 0.5 GB
- ✅ **Compute**: 191.9 hours/month
- ✅ **Connections**: Up to 10,000 (with pooling)
- ✅ **Backups**: Point-in-time restore included
- ✅ **Regions**: Multiple AWS regions

### Vercel Free Tier
- ✅ **Bandwidth**: 100 GB/month
- ✅ **Function Executions**: 1M/month
- ✅ **Build Minutes**: 6,000/month
- ✅ **Custom Domains**: Unlimited

## 🚨 Post-Deployment Checklist

- [ ] Database schema deployed successfully
- [ ] Events migrated from JSON to PostgreSQL
- [ ] Environment variables configured
- [ ] SSL certificates working (automatic with Vercel)
- [ ] Search functionality working
- [ ] Event submission working
- [ ] Admin panel accessible (if implemented)

## 🔍 Monitoring and Maintenance

### Database Monitoring
- Monitor compute usage in Neon dashboard
- Set up alerts for approaching limits
- Regular backups (automatic with Neon)

### Application Monitoring
- Check Vercel function logs
- Monitor performance metrics
- Set up error tracking (Sentry recommended)

## 🆘 Troubleshooting

### Common Issues

**Connection Issues**
```bash
# Test database connection
node -e "import('./lib/database.js').then(db => db.query('SELECT NOW()'))"
```

**Environment Variables Not Loading**
- Ensure `.env` is not committed to Git
- Check Vercel dashboard environment variables
- Restart deployment after adding env vars

**Build Errors**
```bash
# Local build test
npm run build
```

### Support Resources
- [Neon Documentation](https://neon.tech/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Astro Deployment Guide](https://docs.astro.build/en/guides/deploy/)

## 🎉 You're Live!

Once deployed, your Artist Events platform will be:
- ✅ **Globally available** with CDN
- ✅ **Automatically scaling** based on traffic
- ✅ **SSL secured** with HTTPS
- ✅ **Database backed** with PostgreSQL
- ✅ **Cost-effective** with generous free tiers

**Next Steps:**
1. Share your live URL
2. Start promoting events
3. Monitor usage and scale as needed
4. Consider upgrading plans as you grow

---

## 💡 Pro Tips

1. **Set up database branching** in Neon for staging environment
2. **Enable preview deployments** in Vercel for testing
3. **Add monitoring** with tools like Sentry or LogRocket
4. **Optimize images** for faster loading
5. **Set up analytics** to track user engagement 