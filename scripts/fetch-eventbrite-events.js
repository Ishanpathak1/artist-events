import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fetchEventbriteEvents() {
  console.log('🎫 Fetching events from Eventbrite...');
  
  try {
    // Using your Eventbrite credentials
    const token = process.env.EVENTBRITE_TOKEN || 'WZAIHUL546ASMVQY6GFY';
    
    // Search for events near a major city (you can adjust location)
    const response = await fetch(`https://www.eventbriteapi.com/v3/events/search/?location.address=New%20York&location.within=50mi&start_date.range_start=${new Date().toISOString()}&expand=venue,organizer`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.error('Eventbrite API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`Found ${data.events?.length || 0} events from Eventbrite`);
    
    if (!data.events || data.events.length === 0) {
      console.log('No events found from Eventbrite API');
      return;
    }

    // Process and insert events
    for (const event of data.events.slice(0, 10)) { // Limit to first 10 events
      try {
        await insertEvent(event);
        console.log(`✅ Inserted: ${event.name.text}`);
      } catch (error) {
        console.error(`❌ Failed to insert ${event.name.text}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error fetching from Eventbrite:', error);
  }
}

async function insertEvent(eventbriteEvent) {
  const client = await pool.connect();
  
  try {
    // Check if event already exists
    const existing = await client.query('SELECT id FROM events WHERE source_id = $1 AND source_type = $2', [
      eventbriteEvent.id,
      'eventbrite'
    ]);
    
    if (existing.rows.length > 0) {
      console.log(`Event ${eventbriteEvent.name.text} already exists, skipping...`);
      return;
    }

    // Extract event data
    const title = eventbriteEvent.name.text;
    const description = eventbriteEvent.description?.text || eventbriteEvent.summary || '';
    const startDate = new Date(eventbriteEvent.start.utc);
    const endDate = new Date(eventbriteEvent.end.utc);
    const imageUrl = eventbriteEvent.logo?.url || null;
    const sourceUrl = eventbriteEvent.url;
    const ticketPrice = eventbriteEvent.is_free ? 0 : null;
    
    // Handle venue/location
    let venueId = null;
    let customLocation = null;
    
    if (eventbriteEvent.venue) {
      const venue = eventbriteEvent.venue;
      customLocation = `${venue.name || ''}, ${venue.address?.localized_address_display || ''}`.trim();
      
      // Try to find or create venue
      const venueResult = await client.query(`
        INSERT INTO venues (name, address, city, state, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name, address) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [
        venue.name || 'Unknown Venue',
        venue.address?.address_1 || '',
        venue.address?.city || '',
        venue.address?.region || '',
        venue.latitude || null,
        venue.longitude || null
      ]);
      
      venueId = venueResult.rows[0].id;
    }

    // Insert the event
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        venue_id, custom_location, 
        ticket_price, event_type, status, 
        source_url, image_url, source_id, source_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING id
    `, [
      title,
      description.substring(0, 1000), // Limit description length
      startDate,
      endDate,
      venueId,
      customLocation,
      ticketPrice,
      'music', // Default category
      'published',
      sourceUrl,
      imageUrl,
      eventbriteEvent.id,
      'eventbrite'
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Run the script
fetchEventbriteEvents()
  .then(() => {
    console.log('✅ Eventbrite sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Eventbrite sync failed:', error);
    process.exit(1);
  }); 