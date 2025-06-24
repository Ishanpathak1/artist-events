# 🎵 Get Real Music Events with Zyla API

## What You'll Get
Real concert data for major artists:
- **Ed Sheeran** concerts in Madrid, Marseille, Antwerp
- **Taylor Swift** tour dates with real venues
- **Billie Eilish**, **The Weeknd**, **Post Malone** concerts
- **Real venues, real dates, real ticket info**

## Quick Setup (5 minutes)

### 1. Sign Up
- Go to https://zylalabs.com
- Create free account (no credit card needed for trial)
- **Free trial available** with sample data

### 2. Subscribe to API
- Search for "Music Gigs and Concerts Tracker API"
- Subscribe to get your API key
- Copy the API key

### 3. Add Key to Your Project
Choose one of these methods:

**Option A: Environment Variable (Recommended)**
```bash
echo "ZYLA_API_KEY=your_api_key_here" >> .env
```

**Option B: Direct in Script**
Edit `scripts/fetch-zyla-events.js` line 13:
```javascript
const ZYLA_API_KEY = 'your_actual_api_key_here';
```

### 4. Run the Script
```bash
node scripts/fetch-zyla-events.js
```

## What Happens Next
- Fetches real concerts for 15 popular artists
- Adds events with real venues and dates
- Filters out duplicates automatically
- Updates your events database

## Sample Output
```
🎵 Fetching REAL music events from Zyla API...
🔍 Searching for Ed Sheeran concerts...
📊 Found 3 events for Ed Sheeran
✅ Added: Ed Sheeran, Myles Smith and Tori Kelly
✅ Added: Ed Sheeran Summer Tour
🔍 Searching for Taylor Swift concerts...
📊 Found 5 events for Taylor Swift
✅ Added: Taylor Swift Eras Tour
```

## Benefits vs Other APIs
- ✅ **Real data**: Actual concert dates and venues
- ✅ **No approval needed**: Unlike Ticketmaster
- ✅ **Free trial**: Test before paying
- ✅ **Global coverage**: Worldwide concert data
- ✅ **Music focused**: Only music events, no sports

## Cost
- **Free trial**: Test with sample data
- **Paid plans**: Start from $9/month for real-time data

## Alternative: Keep Using NYC API
Your NYC Open Data API is working great with 16 real events! You can:
- Run `npm run fetch:external` weekly for new events
- Wait for Ticketmaster API to activate (24-48 hours)
- Use both APIs together for maximum coverage 