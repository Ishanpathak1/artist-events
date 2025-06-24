import { Pool } from 'pg';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

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

async function fetchSeatGeekEvents() {
  console.log('🎫 Fetching events from SeatGeek...');
  
  try {
    // SeatGeek has a more open API for event discovery
    const response = await fetch('https://api.seatgeek.com/2/events?venue.city=New York&per_page=20&sort=score.desc');
    
    if (!response.ok) {
      console.error('SeatGeek API Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log(`Found ${data.events?.length || 0} events from SeatGeek`);
    
    if (!data.events || data.events.length === 0) {
      console.log('No events found from SeatGeek API');
      return;
    }

    // Process and insert events
    let addedCount = 0;
    for (const event of data.events) {
      try {
        const inserted = await insertEvent(event);
        if (inserted) {
          console.log(`✅ Added: ${event.title}`);
          addedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to insert ${event.title}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully added ${addedCount} new events from SeatGeek!`);
    
  } catch (error) {
    console.error('Error fetching from SeatGeek:', error);
  }
}

async function insertEvent(sgEvent) {
  const client = await pool.connect();
  
  try {
    // Check if event already exists
    const existing = await client.query('SELECT id FROM events WHERE source_id = $1 AND source_type = $2', [
      sgEvent.id.toString(),
      'seatgeek'
    ]);
    
    if (existing.rows.length > 0) {
      console.log(`Event ${sgEvent.title} already exists, skipping...`);
      return false;
    }

    // Extract event data
    const title = sgEvent.title;
    const description = sgEvent.description || `Join us for ${title}. This is a popular event in New York!`;
    const startDate = new Date(sgEvent.datetime_utc);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // +3 hours default
    
    // Extract images
    let imageUrl = null;
    if (sgEvent.performers && sgEvent.performers.length > 0) {
      imageUrl = sgEvent.performers[0].image;
    }
    
    // Extract pricing
    let ticketPrice = null;
    if (sgEvent.stats?.lowest_price) {
      ticketPrice = sgEvent.stats.lowest_price;
    }
    
    // Extract venue/location
    let customLocation = 'New York, NY';
    if (sgEvent.venue) {
      customLocation = `${sgEvent.venue.name}, ${sgEvent.venue.city}, ${sgEvent.venue.state}`;
    }
    
    // Determine category
    let eventType = 'entertainment';
    if (sgEvent.type) {
      const type = sgEvent.type.toLowerCase();
      if (type.includes('concert') || type.includes('music')) eventType = 'music';
      else if (type.includes('sports')) eventType = 'sports';
      else if (type.includes('theater') || type.includes('broadway')) eventType = 'theater';
      else if (type.includes('comedy')) eventType = 'comedy';
    }

    // Insert the event
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        custom_location, ticket_price, event_type, status, 
        source_url, image_url, source_id, source_type,
        slug, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
      ) RETURNING id
    `, [
      title,
      description.substring(0, 1000),
      startDate,
      endDate,
      customLocation,
      ticketPrice,
      eventType,
      'published',
      sgEvent.url,
      imageUrl,
      sgEvent.id.toString(),
      'seatgeek',
      generateSlug(title)
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Also try NYC Open Data for public events
async function fetchNYCEvents() {
  console.log('🏛️ Fetching NYC public events...');
  
  try {
    // Try multiple NYC datasets for more music events
    const urls = [
      'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=20&$where=event_name%20like%20%27%25music%25%27%20OR%20event_name%20like%20%27%25concert%25%27%20OR%20event_name%20like%20%27%25jazz%25%27',
      'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=20&$where=event_name%20like%20%27%25band%25%27%20OR%20event_name%20like%20%27%25orchestra%25%27%20OR%20event_name%20like%20%27%25symphony%25%27',
      'https://data.cityofnewyork.us/resource/tvpp-9vvx.json?$limit=20&$where=event_name%20like%20%27%25festival%25%27%20OR%20event_name%20like%20%27%25performance%25%27%20OR%20event_name%20like%20%27%25show%25%27'
    ];
    
    let allEvents = [];
    
    for (const url of urls) {
      try {
        console.log(`🔍 Searching NYC events: ${url.includes('music') ? 'Music/Concert/Jazz' : url.includes('band') ? 'Band/Orchestra/Symphony' : 'Festival/Performance/Show'}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.log(`❌ NYC API endpoint failed: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`📊 Found ${data.length} events in this category`);
        
        allEvents = allEvents.concat(data);
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error fetching from NYC API:`, error.message);
      }
    }
    
    // Remove duplicates by event name
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.event_name === event.event_name)
    );
    
    console.log(`📋 Total unique events found: ${uniqueEvents.length}`);
    
    let addedCount = 0;
    for (const event of uniqueEvents) {
      try {
        if (event.event_name && event.start_date_time) {
          const inserted = await insertNYCEvent(event);
          if (inserted) {
            console.log(`✅ Added NYC event: ${event.event_name}`);
            addedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Failed to insert NYC event:`, error.message);
      }
    }
    
    console.log(`🎉 Added ${addedCount} NYC public events`);
    
  } catch (error) {
    console.error('Error fetching NYC events:', error);
  }
}

async function insertNYCEvent(nycEvent) {
  const client = await pool.connect();
  
  try {
    const title = nycEvent.event_name;
    const description = nycEvent.event_description || 'A great public event in New York City!';
    
    // Enhanced music filtering
    const titleLower = title.toLowerCase();
    const descLower = description.toLowerCase();
    
    const musicKeywords = [
      'music', 'concert', 'jazz', 'band', 'orchestra', 'symphony', 'choir', 
      'festival', 'performance', 'show', 'arts', 'cultural', 'opera', 'piano',
      'guitar', 'violin', 'drum', 'singer', 'vocal', 'musical', 'harmony',
      'blues', 'rock', 'pop', 'classical', 'indie', 'acoustic', 'live music'
    ];
    
    const skipKeywords = [
      'softball', 'soccer', 'kickball', 'sports', 'picnic', 'meeting', 
      'miscellaneous', 'basketball', 'football', 'tennis', 'volleyball',
      'baseball', 'hockey', 'running', 'walk', 'marathon', 'race'
    ];
    
    // Skip if it contains sports/non-music keywords
    if (skipKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword))) {
      console.log(`⏭️  Skipping non-music event: ${title}`);
      return false;
    }
    
    // Only include if it has music keywords
    if (!musicKeywords.some(keyword => titleLower.includes(keyword) || descLower.includes(keyword))) {
      console.log(`⏭️  Skipping non-music event: ${title}`);
      return false;
    }
    
    const startDate = new Date(nycEvent.start_date_time);
    const endDate = nycEvent.end_date_time ? new Date(nycEvent.end_date_time) : 
                   new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    const customLocation = nycEvent.event_location || 'New York, NY';
    
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        custom_location, ticket_price, event_type, status, 
        source_type, slug, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING id
    `, [
      title,
      description.substring(0, 1000),
      startDate,
      endDate,
      customLocation,
      0, // NYC events are usually free
      'music', // Change to music instead of community
      'published',
      'api',
      generateSlug(title)
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Run both APIs
async function fetchAllEvents() {
  await fetchSeatGeekEvents();
  await fetchNYCEvents();
}

fetchAllEvents()
  .then(() => {
    console.log('✅ All events sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Events sync failed:', error);
    process.exit(1);
  }); 