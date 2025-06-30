import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Updated API key from screenshot
const TICKETMASTER_API_KEY = 'Z8APwACvztmTKFtOWZG3zKomqGVHbwiE';

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchTicketmasterEvents() {
  console.log('🎫 Fetching music events from Ticketmaster...');
  
  try {
    // NYC DMA ID is 345, focusing on music events
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&segmentName=Music&dmaId=345&size=20&sort=date,asc`;
    
    console.log('🔍 Making API request...');
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}): ${errorText}`);
      return;
    }
    
    const data = await response.json();
    const events = data._embedded?.events || [];
    
    console.log(`📊 Found ${events.length} music events from Ticketmaster`);
    
    if (events.length === 0) {
      console.log('📅 No events found. API might need more time to activate.');
      return;
    }
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const event of events) {
      try {
        const venue = event._embedded?.venues?.[0];
        const eventData = {
          title: event.name,
          description: event.info || `Experience ${event.name} live! ${event.pleaseNote || ''}`.substring(0, 500),
          start_date: new Date(event.dates?.start?.dateTime || event.dates?.start?.localDate + 'T20:00:00'),
          end_date: new Date(event.dates?.start?.dateTime || event.dates?.start?.localDate + 'T23:00:00'),
          venue_name: venue?.name || 'TBA',
          location: venue ? `${venue.name}, ${venue.city?.name || ''}, ${venue.state?.stateCode || ''}` : 'New York, NY',
          ticket_price: event.priceRanges?.[0]?.min || 50,
          event_type: getEventType(event.classifications?.[0]?.genre?.name || 'music'),
          image_url: event.images?.[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
          source_type: 'api',
          external_id: event.id,
          ticket_url: event.url
        };
        
        const inserted = await insertEvent(eventData);
        if (inserted) {
          console.log(`✅ Added: ${eventData.title} at ${eventData.venue_name}`);
          addedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to add ${event.name}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully added ${addedCount} Ticketmaster events!`);
    if (skippedCount > 0) {
      console.log(`📝 Skipped ${skippedCount} events (already exist)`);
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch Ticketmaster events:', error.message);
  }
}

function getEventType(genre) {
  const genreMap = {
    'Rock': 'rock',
    'Pop': 'pop',
    'Hip-Hop': 'hip-hop',
    'Rap': 'hip-hop',
    'Jazz': 'jazz',
    'Blues': 'blues',
    'Country': 'country',
    'Electronic': 'electronic',
    'Classical': 'classical',
    'R&B': 'r&b',
    'Folk': 'folk',
    'Indie': 'indie',
    'Alternative': 'alternative',
    'Metal': 'rock'
  };
  
  return genreMap[genre] || 'music';
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

// Run the script
fetchTicketmasterEvents()
  .then(() => {
    console.log('✅ Ticketmaster event sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to sync Ticketmaster events:', error);
    process.exit(1);
  }); 