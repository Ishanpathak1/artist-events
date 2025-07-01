# 🎵 Music Event APIs Setup Guide

This guide explains how to set up **100% legal and free** music event APIs for your artist-events platform.

## 🎤 Available Music Event Sources

### 1. **Bandsintown API** (Recommended!)
- **Status**: ✅ Free, Active, Excellent Coverage
- **Data**: Concerts, festivals, artist tours worldwide
- **Setup**: 
  ```bash
  # No API key needed! Just use your app name
  BANDSINTOWN_API_KEY=your-app-name
  ```
- **Rate Limit**: Very generous for personal use
- **Documentation**: [Bandsintown API Docs](https://app.bandsintown.com/api)

### 2. **Last.fm API** 
- **Status**: ✅ Free, Reliable
- **Data**: Music events, artist information
- **Setup**:
  1. Go to [Last.fm API](https://www.last.fm/api)
  2. Create free account
  3. Get API key
  ```bash
  LASTFM_API_KEY=your-lastfm-api-key
  ```
- **Rate Limit**: 5 requests/second
- **Documentation**: [Last.fm API Docs](https://www.last.fm/api)

### 3. **Ticketmaster Discovery API**
- **Status**: ✅ Free tier available
- **Data**: Official ticket events
- **Setup**:
  1. Go to [Ticketmaster Developer](https://developer.ticketmaster.com/)
  2. Create account and get API key
  ```bash
  TICKETMASTER_API_KEY=your-ticketmaster-key
  ```
- **Rate Limit**: 5000 requests/day (free tier)

### 4. **Curated Public Events**
- **Status**: ✅ No API needed
- **Data**: Hand-curated music events from famous venues
- **Setup**: Ready to use! No configuration needed
- **Coverage**: Major US music venues (Blue Note, Apollo Theater, etc.)

### 5. **Free Music Events**
- **Status**: ✅ Public data aggregation
- **Data**: Community events, local shows
- **Setup**: Ready to use!

## 🚀 Quick Setup

### 1. Create Environment File
```bash
# Copy example environment
cp .env.example .env

# Add your API keys
echo "BANDSINTOWN_API_KEY=your-app-name" >> .env
echo "LASTFM_API_KEY=your-lastfm-key" >> .env
echo "TICKETMASTER_API_KEY=your-ticketmaster-key" >> .env
```

### 2. Test Individual Sources
```bash
# Test Bandsintown (works immediately)
node scripts/fetch-bandsintown-events.js

# Test public events (no API needed)
node scripts/fetch-public-music-events.js

# Test with API keys
node scripts/fetch-lastfm-events.js
node scripts/fetch-ticketmaster-events.js
```

### 3. Sync All Sources
```bash
# Via your web interface
# Click "🎵 Sync Music Events" button

# Or via API
curl "http://localhost:4321/api/sync-events?source=all"
```

## 🎯 Event Types Covered

- **🎸 Rock/Alternative** - Bandsintown, Ticketmaster
- **🎷 Jazz** - Curated venues (Blue Note, etc.)
- **🎤 Hip-Hop/R&B** - Apollo Theater, SOB's
- **🎻 Classical** - Symphony halls, orchestras  
- **🎸 Country** - Grand Ole Opry, Nashville venues
- **💃 Electronic** - Festival circuits, DJ shows
- **🎵 Indie/Folk** - Independent venues, coffee shops
- **🤘 Punk/Metal** - Underground venues

## 📊 Expected Results

After full sync, you should see:
- **50-200 events** from all sources combined
- **Multiple cities** covered (NYC, LA, Chicago, Austin, etc.)
- **Diverse genres** and price points
- **Mix of venues** from intimate clubs to large arenas

## 🔒 Legal & Ethical Notes

✅ **All sources are completely legal:**
- Using official public APIs
- Respecting rate limits  
- Following terms of service
- No scraping without permission
- Attribution where required

✅ **Best practices:**
- Cache API responses
- Respect rate limits
- Handle errors gracefully
- Don't overload servers

## 🆘 Troubleshooting

### No Events Appearing?
1. Check database connection
2. Verify API keys in `.env`
3. Check console for error messages
4. Try individual scripts first

### API Errors?
- **403 Forbidden**: Check API key
- **429 Too Many Requests**: Wait and retry
- **404 Not Found**: Check endpoint URLs

### Rate Limiting?
- Bandsintown: Very generous, rarely an issue
- Last.fm: 5 req/sec, built-in delays
- Ticketmaster: 5000/day, monitor usage

## 🎉 Success Indicators

You'll know it's working when:
- Events appear with **🔥 Live** badges
- Multiple **event types** (jazz, rock, electronic)
- **Different cities** represented
- **Ticket URLs** link to external sites
- **Realistic dates** (upcoming events)

## 🔄 Automation

Set up automatic syncing:
```bash
# Daily sync at 2 AM (already configured in vercel.json)
# Manually trigger: click "🎵 Sync Music Events"
```

---

**Ready to discover amazing music events! 🎵🎪** 