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

// FREE music events from multiple sources
async function fetchFreeRealMusicEvents() {
  console.log('🎵 Fetching FREE real music events from multiple sources...');
  
  let totalAdded = 0;
  
  // Source 1: Bandsintown public events (free)
  totalAdded += await fetchBandsintown();
  
  // Source 2: Last.fm events (free)
  totalAdded += await fetchLastFmEvents();
  
  // Source 3: More NYC cultural events
  totalAdded += await fetchNYCCulturalEvents();
  
  console.log(`🎉 Total real music events added: ${totalAdded}`);
}

// Bandsintown public events (free)
async function fetchBandsintown() {
  console.log('\n🎪 Fetching from Bandsintown public events...');
  
  try {
    // Search for public events in NYC (no API key needed)
    const artists = ['coldplay', 'john-mayer', 'billie-eilish', 'the-weeknd', 'post-malone'];
    let addedCount = 0;
    
    for (const artist of artists) {
      try {
        // Use Bandsintown's public endpoint (no auth required)
        const response = await fetch(`https://rest.bandsintown.com/artists/${artist}/events?app_id=your-app&date=upcoming`);
        
        if (response.ok) {
          const events = await response.json();
          console.log(`🎤 Found ${events.length} events for ${artist}`);
          
          for (const event of events.slice(0, 2)) { // Limit to 2 per artist
            if (event.venue && event.venue.city && event.venue.city.toLowerCase().includes('new york')) {
              const inserted = await insertMusicEvent({
                title: `${artist.replace('-', ' ')} Live Concert`,
                description: `Experience ${artist.replace('-', ' ')} live in concert! ${event.description || 'Don\'t miss this incredible performance.'}`,
                start_date: new Date(event.datetime),
                venue_name: event.venue.name,
                location: `${event.venue.name}, ${event.venue.city}, ${event.venue.country}`,
                ticket_url: event.url,
                source_type: 'api',
                event_type: 'music',
                image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600'
              });
              
              if (inserted) {
                console.log(`✅ Added: ${artist.replace('-', ' ')} Live Concert`);
                addedCount++;
              }
            }
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ Error fetching ${artist}: ${error.message}`);
      }
    }
    
    return addedCount;
    
  } catch (error) {
    console.error('Error fetching Bandsintown events:', error);
    return 0;
  }
}

// Last.fm events (free)
async function fetchLastFmEvents() {
  console.log('\n🎵 Fetching from Last.fm events...');
  
  try {
    // Last.fm has a free API for event data
    const API_KEY = 'sample'; // Public demo key
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?method=geo.getevents&location=new+york&api_key=${API_KEY}&format=json&limit=10`);
    
    if (response.ok) {
      const data = await response.json();
      const events = data.events?.event || [];
      
      console.log(`🎤 Found ${events.length} Last.fm events`);
      
      let addedCount = 0;
      for (const event of events) {
        try {
          const inserted = await insertMusicEvent({
            title: event.title || `${event.artists?.artist || 'Live Music'} Concert`,
            description: `Live music event in New York. ${event.description || 'Join us for an amazing musical experience!'}`,
            start_date: new Date(event.startDate),
            venue_name: event.venue?.name || 'TBA',
            location: `${event.venue?.location?.city || 'New York'}, NY`,
            ticket_url: event.url,
            source_type: 'api',
            event_type: 'music',
            image_url: event.image?.[2]?.['#text'] || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600'
          });
          
          if (inserted) {
            console.log(`✅ Added: ${event.title || 'Live Music Concert'}`);
            addedCount++;
          }
        } catch (error) {
          console.log(`❌ Error processing event: ${error.message}`);
        }
      }
      
      return addedCount;
    }
    
    return 0;
    
  } catch (error) {
    console.error('Error fetching Last.fm events:', error);
    return 0;
  }
}

// NYC Cultural Events (different dataset)
async function fetchNYCCulturalEvents() {
  console.log('\n🏛️ Fetching NYC cultural/music events...');
  
  try {
    // Different NYC dataset focusing on cultural events
    const response = await fetch('https://data.cityofnewyork.us/resource/ah4y-7qbt.json?$limit=15&$where=event_type%20like%20%27%25music%25%27%20OR%20event_type%20like%20%27%25concert%25%27');
    
    if (response.ok) {
      const events = await response.json();
      console.log(`🎭 Found ${events.length} NYC cultural events`);
      
      let addedCount = 0;
      for (const event of events) {
        try {
          if (event.event_name && event.event_start_date) {
            const inserted = await insertMusicEvent({
              title: event.event_name,
              description: event.event_description || 'A cultural music event in New York City',
              start_date: new Date(event.event_start_date),
              venue_name: event.event_location || 'NYC Venue',
              location: event.event_location || 'New York, NY',
              source_type: 'api',
              event_type: 'music',
              ticket_price: 0,
              image_url: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600'
            });
            
            if (inserted) {
              console.log(`✅ Added: ${event.event_name}`);
              addedCount++;
            }
          }
        } catch (error) {
          console.log(`❌ Error processing event: ${error.message}`);
        }
      }
      
      return addedCount;
    }
    
    return 0;
    
  } catch (error) {
    console.error('Error fetching NYC cultural events:', error);
    return 0;
  }
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

// Add some curated free music events happening in NYC
async function addCuratedFreeEvents() {
  console.log('\n🎪 Adding curated free music events...');
  
  const freeEvents = [
    {
      title: 'SummerStage Central Park Free Concert Series',
      description: 'Free outdoor concerts featuring local and touring artists in Central Park. Enjoy live music in one of NYC\'s most beautiful settings.',
      start_date: new Date('2025-07-15T19:00:00Z'),
      venue_name: 'Central Park SummerStage',
      location: 'Central Park SummerStage, New York, NY',
      event_type: 'music',
      source_type: 'manual',
      ticket_price: 0,
      image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600'
    },
    {
      title: 'Bryant Park Free Summer Concerts',
      description: 'Free weekly concerts every Thursday evening in Bryant Park. Features a mix of genres from jazz to pop.',
      start_date: new Date('2025-08-07T18:30:00Z'),
      venue_name: 'Bryant Park',
      location: 'Bryant Park, Midtown Manhattan, NY',
      event_type: 'music',
      source_type: 'manual',
      ticket_price: 0,
      image_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600'
    },
    {
      title: 'Brooklyn Bridge Park Pop-Up Concerts',
      description: 'Surprise pop-up concerts with local Brooklyn musicians. Free admission with stunning views of Manhattan skyline.',
      start_date: new Date('2025-09-12T17:00:00Z'),
      venue_name: 'Brooklyn Bridge Park',
      location: 'Brooklyn Bridge Park, Brooklyn, NY',
      event_type: 'music',
      source_type: 'manual',
      ticket_price: 0,
      image_url: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600'
    }
  ];
  
  let addedCount = 0;
  for (const event of freeEvents) {
    const inserted = await insertMusicEvent(event);
    if (inserted) {
      console.log(`✅ Added: ${event.title}`);
      addedCount++;
    }
  }
  
  return addedCount;
}

// Run all free sources
async function runAllFreeSources() {
  await fetchFreeRealMusicEvents();
  const curatedCount = await addCuratedFreeEvents();
  console.log(`\n🎵 Also added ${curatedCount} curated free events`);
}

runAllFreeSources()
  .then(() => {
    console.log('\n✅ Free music events sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Free events sync failed:', error);
    process.exit(1);
  }); 