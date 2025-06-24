import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🔑 TO GET REAL EVENTS: Add your Zyla API key here
// 1. Go to https://zylalabs.com (free trial available)
// 2. Subscribe to "Music Gigs and Concerts Tracker API"
// 3. Copy your API key and paste it below:
const ZYLA_API_KEY = process.env.ZYLA_API_KEY || 'YOUR_ZYLA_API_KEY_HERE';

// Popular artists to fetch real concert data for
const POPULAR_ARTISTS = [
  'Ed Sheeran',
  'Taylor Swift', 
  'The Weeknd',
  'Billie Eilish',
  'Post Malone',
  'Ariana Grande',
  'Dua Lipa',
  'Drake',
  'Coldplay',
  'John Mayer',
  'Harry Styles',
  'Olivia Rodrigo',
  'Bad Bunny',
  'The 1975',
  'Arctic Monkeys'
];

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchZylaEvents() {
  console.log('🎵 Fetching REAL music events from Zyla API...');
  
  let totalAdded = 0;
  let totalSkipped = 0;
  
  for (const artist of POPULAR_ARTISTS) {
    try {
      console.log(`\n🔍 Searching for ${artist} concerts...`);
      
      const url = `https://zylalabs.com/api/94/music+gigs+and+concerts+tracker+api/146/get+concerts+by+artist?name=${encodeURIComponent(artist)}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${ZYLA_API_KEY}`
        }
      });
      
      if (!response.ok) {
        console.log(`❌ API Error for ${artist} (${response.status}): ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data.success || !data.upcomingEvents) {
        console.log(`📅 No upcoming events found for ${artist}`);
        continue;
      }
      
      const events = Object.entries(data.upcomingEvents);
      console.log(`📊 Found ${events.length} events for ${artist}`);
      
      let addedCount = 0;
      let skippedCount = 0;
      
      for (const [date, eventInfo] of events) {
        try {
          const eventData = {
            title: eventInfo.event,
            description: `Experience ${artist} live! ${eventInfo.eventType === 'concert' ? 'Don\'t miss this incredible concert experience.' : 'Join this amazing live event.'}`,
            start_date: new Date(date + 'T20:00:00Z'),
            end_date: new Date(date + 'T23:00:00Z'),
            venue_name: extractVenueName(eventInfo.location),
            location: eventInfo.location,
            ticket_price: getEstimatedPrice(artist),
            event_type: getEventType(artist),
            image_url: getArtistImage(artist),
            source_type: 'api',
            external_id: eventInfo.event_id,
            ticket_url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}`
          };
          
          const inserted = await insertEvent(eventData);
          if (inserted) {
            console.log(`✅ Added: ${eventData.title}`);
            addedCount++;
            totalAdded++;
          } else {
            skippedCount++;
            totalSkipped++;
          }
        } catch (error) {
          console.error(`❌ Failed to add event: ${error.message}`);
        }
      }
      
      if (addedCount > 0) {
        console.log(`🎉 Added ${addedCount} events for ${artist}`);
      }
      if (skippedCount > 0) {
        console.log(`📝 Skipped ${skippedCount} events (already exist)`);
      }
      
      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error fetching events for ${artist}:`, error.message);
    }
  }
  
  console.log(`\n🎵 Summary: Added ${totalAdded} real events, skipped ${totalSkipped}`);
  
  if (totalAdded === 0) {
    console.log('\n⚠️  No events were added. This could be because:');
    console.log('1. You need to sign up for a Zyla API key at https://zylalabs.com');
    console.log('2. The API key needs to be added to the script');
    console.log('3. All events already exist in the database');
  }
}

function extractVenueName(location) {
  // Extract venue name from location string
  const parts = location.split(',');
  return parts[0].trim();
}

function getEstimatedPrice(artist) {
  // Estimated ticket prices based on artist popularity
  const premiumArtists = ['Taylor Swift', 'Ed Sheeran', 'The Weeknd', 'Drake'];
  const midTierArtists = ['Billie Eilish', 'Post Malone', 'Ariana Grande', 'Dua Lipa'];
  
  if (premiumArtists.includes(artist)) return 150;
  if (midTierArtists.includes(artist)) return 85;
  return 65;
}

function getEventType(artist) {
  const artistGenres = {
    'Ed Sheeran': 'pop',
    'Taylor Swift': 'pop',
    'The Weeknd': 'r&b',
    'Billie Eilish': 'alternative',
    'Post Malone': 'hip-hop',
    'Ariana Grande': 'pop',
    'Dua Lipa': 'pop',
    'Drake': 'hip-hop',
    'Coldplay': 'rock',
    'John Mayer': 'rock'
  };
  
  return artistGenres[artist] || 'music';
}

function getArtistImage(artist) {
  // Music-themed stock images
  const images = [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600',
    'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600',
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=600',
    'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600'
  ];
  
  return images[Math.floor(Math.random() * images.length)];
}

async function insertEvent(eventData) {
  const client = await pool.connect();
  
  try {
    // Check if event already exists by title or external_id
    const existing = await client.query(
      'SELECT id FROM events WHERE title = $1 OR external_id = $2', 
      [eventData.title, eventData.external_id]
    );
    
    if (existing.rows.length > 0) {
      return false;
    }

    // Insert the event
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        custom_location, ticket_price, event_type, status, 
        image_url, source_type, slug, external_id, ticket_url,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING id
    `, [
      eventData.title,
      eventData.description,
      eventData.start_date,
      eventData.end_date,
      eventData.location,
      eventData.ticket_price,
      eventData.event_type,
      'published',
      eventData.image_url,
      eventData.source_type,
      generateSlug(eventData.title),
      eventData.external_id,
      eventData.ticket_url
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Demo mode - show what the API can do without requiring signup
async function demoZylaAPI() {
  console.log('🎵 DEMO: What Zyla API can provide (example Ed Sheeran data)');
  console.log('');
  console.log('Sample API Response:');
  console.log('✅ Ed Sheeran concerts found:');
  console.log('  📅 2025-05-30: Ed Sheeran, Myles Smith and Tori Kelly');
  console.log('  📍 Estadio Cívitas Metropolitano, Madrid, Spain');
  console.log('  📅 2025-06-06: Ed Sheeran, Myles Smith and Tori Kelly');
  console.log('  📍 Orange Vélodrome, Marseille, France');
  console.log('  📅 2025-08-08: Ed Sheeran, Myles Smith and Tori Kelly');
  console.log('  📍 Middenvijver Linkeroever, Antwerp, Belgium');
  console.log('');
  console.log('🔑 To get real data:');
  console.log('1. Sign up at https://zylalabs.com (free trial available)');
  console.log('2. Subscribe to "Music Gigs and Concerts Tracker API"');
  console.log('3. Add your API key to this script');
  console.log('4. Run the script to get real concert data!');
}

// Run the script
if (ZYLA_API_KEY === 'YOUR_ZYLA_API_KEY') {
  demoZylaAPI()
    .then(() => {
      console.log('✅ Demo completed - sign up for Zyla API to get real events');
      process.exit(0);
    });
} else {
  fetchZylaEvents()
    .then(() => {
      console.log('✅ Real event sync completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to sync events:', error);
      process.exit(1);
    });
} 