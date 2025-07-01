import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Last.fm API - Free tier, legal to use
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || 'get-free-key-from-last.fm';

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchLastFMEvents() {
  console.log('🎧 Fetching music events from Last.fm...');
  
  try {
    // Major cities for music events
    const locations = [
      { city: 'New York', country: 'United States' },
      { city: 'Los Angeles', country: 'United States' },
      { city: 'Chicago', country: 'United States' },
      { city: 'Austin', country: 'United States' },
      { city: 'Nashville', country: 'United States' }
    ];
    
    let totalAdded = 0;
    
    for (const location of locations) {
      console.log(`🌆 Searching events in ${location.city}...`);
      
      // Last.fm geo.getEvents endpoint
      const url = `https://ws.audioscrobbler.com/2.0/?method=geo.getevents&location=${encodeURIComponent(location.city)}&api_key=${LASTFM_API_KEY}&format=json&limit=20`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ API Error for ${location.city} (${response.status})`);
        continue;
      }
      
      const data = await response.json();
      const events = data.events?.event || [];
      
      if (!Array.isArray(events) && events.id) {
        // Single event returned
        events = [events];
      } else if (!Array.isArray(events)) {
        console.log(`📅 No events found in ${location.city}`);
        continue;
      }
      
      console.log(`📊 Found ${events.length} events in ${location.city}`);
      
      for (const event of events) {
        try {
          // Parse event data
          const artists = Array.isArray(event.artists?.artist) 
            ? event.artists.artist.map(a => typeof a === 'string' ? a : a['#text']).join(', ')
            : (typeof event.artists?.artist === 'string' ? event.artists.artist : event.artists?.artist?.['#text'] || 'Unknown Artist');
          
          const eventData = {
            title: event.title || `${artists} - Live Concert`,
            description: `Experience ${artists} live! ${event.description || 'An amazing live music experience awaits!'}`.substring(0, 500),
            start_date: event.startDate ? new Date(event.startDate) : new Date(),
            venue_name: event.venue?.name || 'TBA',
            location: `${event.venue?.location?.city || location.city}, ${event.venue?.location?.country || location.country}`,
            ticket_price: 35, // Default estimated price
            event_type: 'concert',
            image_url: event.image?.[2]?.['#text'] || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
            source_type: 'api',
            external_id: `lastfm_${event.id}`,
            ticket_url: event.url || event.website
          };
          
          const inserted = await insertEvent(eventData);
          if (inserted) {
            console.log(`✅ Added: ${eventData.title} at ${eventData.venue_name}`);
            totalAdded++;
          }
        } catch (error) {
          console.error(`❌ Failed to add event:`, error.message);
        }
      }
      
      // Rate limiting - be respectful  
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`\n🎉 Successfully added ${totalAdded} Last.fm events!`);
    
  } catch (error) {
    console.error('❌ Failed to fetch Last.fm events:', error.message);
  }
}

async function insertEvent(eventData) {
  const client = await pool.connect();
  
  try {
    // Check if event already exists
    const existing = await client.query(
      'SELECT id FROM events WHERE external_id = $1', 
      [eventData.external_id]
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
      new Date(eventData.start_date.getTime() + 3 * 60 * 60 * 1000), // +3 hours
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

// Run the script
fetchLastFMEvents()
  .then(() => {
    console.log('✅ Last.fm event sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to sync Last.fm events:', error);
    process.exit(1);
  }); 