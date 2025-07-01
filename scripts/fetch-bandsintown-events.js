import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Bandsintown API - Free tier, legal to use
const BANDSINTOWN_API_KEY = process.env.BANDSINTOWN_API_KEY || 'your-app-name';

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchBandsintownEvents() {
  console.log('🎵 Fetching music events from Bandsintown...');
  
  try {
    // Popular cities for music events
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Austin', 'Nashville', 'Boston'];
    let totalAdded = 0;
    
    for (const city of cities) {
      console.log(`🌆 Searching events in ${city}...`);
      
      // Bandsintown events endpoint
      const url = `https://rest.bandsintown.com/events/search?app_id=${BANDSINTOWN_API_KEY}&location=${encodeURIComponent(city)}&radius=25&date=upcoming&per_page=20`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ API Error for ${city} (${response.status})`);
        continue;
      }
      
      const events = await response.json();
      
      if (!Array.isArray(events)) {
        console.log(`📅 No events found in ${city}`);
        continue;
      }
      
      console.log(`📊 Found ${events.length} events in ${city}`);
      
      for (const event of events) {
        try {
          const eventData = {
            title: `${event.artist?.name || 'Unknown Artist'} - Live`,
            description: `Experience ${event.artist?.name || 'this amazing artist'} live in concert! ${event.description || ''}`.substring(0, 500),
            start_date: new Date(event.datetime),
            venue_name: event.venue?.name || 'TBA',
            location: `${event.venue?.city || city}, ${event.venue?.region || ''}, ${event.venue?.country || 'US'}`,
            ticket_price: 45, // Default estimated price
            event_type: 'concert',
            image_url: event.artist?.image_url || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
            source_type: 'api',
            external_id: `bandsintown_${event.id}`,
            ticket_url: event.url || event.ticket_url
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎉 Successfully added ${totalAdded} Bandsintown events!`);
    
  } catch (error) {
    console.error('❌ Failed to fetch Bandsintown events:', error.message);
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
fetchBandsintownEvents()
  .then(() => {
    console.log('✅ Bandsintown event sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to sync Bandsintown events:', error);
    process.exit(1);
  }); 