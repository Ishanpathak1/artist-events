import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Function to generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove special characters
    .replace(/\s+/g, '-')        // Replace spaces with hyphens
    .replace(/-+/g, '-')         // Replace multiple hyphens with single hyphen
    .trim();
}

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const demoEvents = [
  {
    title: "Summer Music Festival 2025",
    description: "Join us for an amazing day of live music featuring local and international artists. Food trucks, art installations, and family-friendly activities.",
    start_date: "2025-07-15T14:00:00Z",
    end_date: "2025-07-15T23:00:00Z",
    venue_name: "Central Park Bandshell",
    location: "Central Park, New York, NY",
    ticket_price: 45,
    event_type: "music",
    image_url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500",
    source_type: "eventbrite"
  },
  {
    title: "Tech Startup Networking Night",
    description: "Connect with fellow entrepreneurs, investors, and tech enthusiasts. Pitch your ideas, find co-founders, and build valuable connections.",
    start_date: "2025-06-30T18:30:00Z",
    end_date: "2025-06-30T21:30:00Z",
    venue_name: "WeWork Times Square",
    location: "Times Square, New York, NY",
    ticket_price: 0,
    event_type: "networking",
    image_url: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=500",
    source_type: "meetup"
  },
  {
    title: "Abstract Art Workshop: Paint & Wine",
    description: "Unleash your creativity in this guided painting workshop. All materials provided, wine included. Perfect for beginners and experienced artists alike.",
    start_date: "2025-07-02T19:00:00Z",
    end_date: "2025-07-02T21:30:00Z",
    venue_name: "Canvas & Cork Studio",
    location: "SoHo, New York, NY",
    ticket_price: 35,
    event_type: "art",
    image_url: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=500",
    source_type: "eventbrite"
  },
  {
    title: "Brooklyn Food Truck Festival",
    description: "Taste the best street food from over 50 food trucks. Live music, craft beer, and family entertainment all day long.",
    start_date: "2025-08-10T11:00:00Z",
    end_date: "2025-08-10T20:00:00Z",
    venue_name: "Prospect Park",
    location: "Brooklyn, NY",
    ticket_price: 0,
    event_type: "festival",
    image_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500",
    source_type: "facebook"
  },
  {
    title: "Photography Masterclass: Urban Landscapes",
    description: "Learn professional photography techniques for capturing stunning urban scenes. Bring your camera and join us for hands-on learning.",
    start_date: "2025-07-08T09:00:00Z",
    end_date: "2025-07-08T16:00:00Z",
    venue_name: "Photo Academy NYC",
    location: "Manhattan, New York, NY",
    ticket_price: 120,
    event_type: "workshop",
    image_url: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=500",
    source_type: "skillshare"
  },
  {
    title: "Jazz Night at Blue Note",
    description: "Experience world-class jazz in the heart of Greenwich Village. Tonight featuring Grammy-nominated pianist Marcus Roberts Trio.",
    start_date: "2025-07-12T20:00:00Z",
    end_date: "2025-07-12T23:00:00Z",
    venue_name: "Blue Note Jazz Club",
    location: "Greenwich Village, New York, NY",
    ticket_price: 65,
    event_type: "music",
    image_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=500",
    source_type: "venue_direct"
  },
  {
    title: "Digital Marketing for Small Business",
    description: "Learn essential digital marketing strategies to grow your business online. SEO, social media, email marketing, and more.",
    start_date: "2025-07-20T10:00:00Z",
    end_date: "2025-07-20T17:00:00Z",
    venue_name: "Business Hub NYC",
    location: "Financial District, New York, NY",
    ticket_price: 85,
    event_type: "workshop",
    image_url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500",
    source_type: "meetup"
  },
  {
    title: "Summer Rooftop Comedy Show",
    description: "Laugh the night away with top comedians under the stars. Amazing city views, cocktails, and non-stop laughs guaranteed.",
    start_date: "2025-08-05T19:30:00Z",
    end_date: "2025-08-05T22:00:00Z",
    venue_name: "Skyline Rooftop",
    location: "Midtown, New York, NY",
    ticket_price: 40,
    event_type: "entertainment",
    image_url: "https://images.unsplash.com/photo-1587899897387-091f3e5a119a?w=500",
    source_type: "eventbrite"
  },
  {
    title: "Yoga in the Park: Sunrise Session",
    description: "Start your day with peaceful yoga practice in beautiful Central Park. All levels welcome. Bring your own mat.",
    start_date: "2025-07-25T06:30:00Z",
    end_date: "2025-07-25T07:30:00Z",
    venue_name: "Central Park Great Lawn",
    location: "Central Park, New York, NY",
    ticket_price: 0,
    event_type: "wellness",
    image_url: "https://images.unsplash.com/photo-1506629905987-b65e5eaa807e?w=500",
    source_type: "meetup"
  },
  {
    title: "Craft Beer Tasting & Brewery Tour",
    description: "Discover NYC's best craft breweries on this guided tasting tour. Learn about the brewing process and sample exclusive beers.",
    start_date: "2025-08-15T15:00:00Z",
    end_date: "2025-08-15T18:00:00Z",
    venue_name: "Brooklyn Brewery",
    location: "Williamsburg, Brooklyn, NY",
    ticket_price: 55,
    event_type: "food_drink",
    image_url: "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=500",
    source_type: "eventbrite"
  }
];

async function addDemoEvents() {
  console.log('🎯 Adding demo events to database...');
  
  for (const event of demoEvents) {
    try {
      await insertEvent(event);
      console.log(`✅ Added: ${event.title}`);
    } catch (error) {
      console.error(`❌ Failed to add ${event.title}:`, error.message);
    }
  }
  
  console.log('🎉 Demo events added successfully!');
}

async function insertEvent(eventData) {
  const client = await pool.connect();
  
  try {
    // Check if event already exists by title and date
    const existing = await client.query('SELECT id FROM events WHERE title = $1 AND start_date = $2', [
      eventData.title,
      eventData.start_date
    ]);
    
    if (existing.rows.length > 0) {
      console.log(`Event ${eventData.title} already exists, skipping...`);
      return;
    }

    // Create or find venue
    let venueId = null;
    // Skip venue creation for now, just use custom_location

    // Insert the event
    const result = await client.query(`
      INSERT INTO events (
        title, description, start_date, end_date, 
        venue_id, custom_location, 
        ticket_price, event_type, status, 
        image_url, source_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
      ) RETURNING id
    `, [
      eventData.title,
      eventData.description,
      new Date(eventData.start_date),
      new Date(eventData.end_date),
      venueId,
      eventData.venue_name ? `${eventData.venue_name}, ${eventData.location}` : eventData.location,
      eventData.ticket_price,
      eventData.event_type,
      'published',
      eventData.image_url,
      eventData.source_type
    ]);
    
    return result.rows[0].id;
    
  } finally {
    client.release();
  }
}

// Run the script
addDemoEvents()
  .then(() => {
    console.log('✅ Demo events sync completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Demo events sync failed:', error);
    process.exit(1);
  }); 