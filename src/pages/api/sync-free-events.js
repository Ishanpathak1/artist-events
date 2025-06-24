import { Pool } from 'pg';
import fetch from 'node-fetch';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Insert music event with duplicate checking
async function insertMusicEvent(eventData) {
  const client = await pool.connect();
  
  try {
    // Check for duplicates by title
    const existing = await client.query('SELECT id FROM events WHERE title = $1', [eventData.title]);
    
    if (existing.rows.length > 0) {
      return false; // Skip duplicate
    }

    // Create end date if not provided
    const endDate = eventData.end_date || new Date(eventData.start_date.getTime() + 3 * 60 * 60 * 1000);

    // Insert the event
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        custom_location, ticket_price, event_type, status, 
        image_url, source_type, slug, ticket_url,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
      ) RETURNING id
    `, [
      eventData.title,
      eventData.description.substring(0, 1000),
      eventData.start_date,
      endDate,
      eventData.location,
      eventData.ticket_price || 0,
      eventData.event_type || 'music',
      'published',
      eventData.image_url,
      eventData.source_type || 'api',
      generateSlug(eventData.title),
      eventData.ticket_url
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Fetch NYC cultural/music events
async function fetchNYCMusicEvents() {
  try {
    const response = await fetch('https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=20&$where=event_type%20like%20%27%25music%25%27%20OR%20event_type%20like%20%27%25concert%25%27%20OR%20event_type%20like%20%27%25performance%25%27');
    
    if (!response.ok) {
      throw new Error(`NYC API error: ${response.status}`);
    }
    
    const events = await response.json();
    let addedCount = 0;
    
    for (const event of events) {
      try {
        if (event.event_name && event.start_date_time) {
          // Filter for music-related keywords
          const musicKeywords = ['music', 'concert', 'band', 'jazz', 'rock', 'pop', 'hip hop', 'classical', 'opera', 'symphony', 'festival', 'live', 'performance'];
          const eventText = `${event.event_name} ${event.event_description || ''}`.toLowerCase();
          
          if (musicKeywords.some(keyword => eventText.includes(keyword))) {
            const inserted = await insertMusicEvent({
              title: event.event_name,
              description: event.event_description || 'A music event in New York City',
              start_date: new Date(event.start_date_time),
              venue_name: event.event_location || 'NYC Venue',
              location: event.event_location || 'New York, NY',
              source_type: 'api',
              event_type: 'music',
              ticket_price: 0,
              image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600'
            });
            
            if (inserted) {
              addedCount++;
            }
          }
        }
      } catch (error) {
        console.log(`Error processing event: ${error.message}`);
      }
    }
    
    return addedCount;
  } catch (error) {
    console.error('Error fetching NYC events:', error);
    return 0;
  }
}

export async function GET(context) {
  try {
    // Check for authorization
    const authHeader = context.request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.SYNC_API_KEY || 'your-secret-sync-key'}`;
    
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🎵 Starting free music events sync...');
    
    const addedCount = await fetchNYCMusicEvents();
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${addedCount} new music events`,
      events_added: addedCount,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Free events sync error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(context) {
  return await GET(context);
} 