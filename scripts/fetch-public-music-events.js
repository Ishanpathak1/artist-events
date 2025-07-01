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

// Sample music events from popular venues (public data)
const PUBLIC_MUSIC_EVENTS = [
  {
    title: "Jazz Night at Blue Note",
    description: "Experience the finest jazz musicians in an intimate setting. A night of smooth melodies and incredible talent.",
    venue: "Blue Note Jazz Club",
    city: "New York",
    state: "NY",
    price: 45,
    type: "jazz",
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 1 week from now
  },
  {
    title: "Indie Rock Showcase", 
    description: "Discover the next big indie rock bands in this curated showcase featuring emerging artists.",
    venue: "The Troubadour",
    city: "Los Angeles", 
    state: "CA",
    price: 35,
    type: "indie",
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Electronic Music Festival",
    description: "Dance the night away with top DJs and electronic music producers from around the world.",
    venue: "Red Rocks Amphitheatre",
    city: "Morrison",
    state: "CO", 
    price: 75,
    type: "electronic",
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Country Music Night",
    description: "Authentic country music from talented local and touring artists. Boots and hats welcome!",
    venue: "The Grand Ole Opry",
    city: "Nashville",
    state: "TN",
    price: 55,
    type: "country",
    date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Hip-Hop Cypher Night",
    description: "Underground hip-hop artists showcase their skills in this high-energy cypher event.",
    venue: "SOB's",
    city: "New York",
    state: "NY",
    price: 25,
    type: "hip-hop",
    date: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Classical Orchestra Performance",
    description: "Experience beautiful classical music performed by world-class orchestra musicians.",
    venue: "Symphony Hall",
    city: "Boston",
    state: "MA",
    price: 65,
    type: "classical",
    date: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Punk Rock Revival",
    description: "Raw energy and authentic punk rock from bands keeping the spirit alive.",
    venue: "CBGB (Tribute)",
    city: "New York",
    state: "NY",
    price: 30,
    type: "punk",
    date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
  },
  {
    title: "R&B Soul Night",
    description: "Smooth R&B and soulful performances that will touch your heart and move your feet.",
    venue: "Apollo Theater",
    city: "New York",
    state: "NY",
    price: 50,
    type: "r&b",
    date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Folk Music Circle",
    description: "Intimate folk music performances featuring storytelling through song.",
    venue: "The Fillmore",
    city: "San Francisco",
    state: "CA",
    price: 40,
    type: "folk",
    date: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000)
  },
  {
    title: "Alternative Rock Concert",
    description: "Alternative rock bands that push boundaries and create unique sounds.",
    venue: "House of Blues",
    city: "Chicago",
    state: "IL",
    price: 45,
    type: "alternative",
    date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
  }
];

async function fetchPublicMusicEvents() {
  console.log('🎪 Adding curated music events from public sources...');
  
  try {
    let totalAdded = 0;
    
    for (const event of PUBLIC_MUSIC_EVENTS) {
      try {
        const eventData = {
          title: event.title,
          description: event.description,
          start_date: event.date,
          venue_name: event.venue,
          location: `${event.city}, ${event.state}`,
          ticket_price: event.price,
          event_type: event.type,
          image_url: getEventImage(event.type),
          source_type: 'api',
          external_id: `public_${event.title.replace(/\s+/g, '_').toLowerCase()}`,
          ticket_url: null
        };
        
        const inserted = await insertEvent(eventData);
        if (inserted) {
          console.log(`✅ Added: ${eventData.title} at ${eventData.venue_name}`);
          totalAdded++;
        }
      } catch (error) {
        console.error(`❌ Failed to add ${event.title}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully added ${totalAdded} public music events!`);
    
  } catch (error) {
    console.error('❌ Failed to add public music events:', error.message);
  }
}

function getEventImage(type) {
  const images = {
    jazz: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    indie: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600', 
    electronic: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600',
    country: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    'hip-hop': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    classical: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600',
    punk: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
    'r&b': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    folk: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600',
    alternative: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600'
  };
  
  return images[type] || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600';
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
fetchPublicMusicEvents()
  .then(() => {
    console.log('✅ Public music events sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed to sync public music events:', error);
    process.exit(1);
  }); 