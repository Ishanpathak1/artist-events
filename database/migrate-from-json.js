/**
 * Migration script to convert existing JSON data to PostgreSQL database
 * Run this after setting up the database with schema.sql
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Database configuration - update with your actual database details
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'artist_events',
  user: 'your_username',
  password: 'your_password'
};

/**
 * Convert existing JSON events to database format
 */
async function migrateEvents() {
  const { Client } = await import('pg');
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('Connected to database');

    // Read existing events from JSON
    const eventsPath = path.join(process.cwd(), 'data', 'events.json');
    const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
    
    console.log(`Found ${eventsData.length} events to migrate`);

    for (const event of eventsData) {
      await migrateEvent(client, event);
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

/**
 * Migrate a single event from JSON to database
 */
async function migrateEvent(client, jsonEvent) {
  try {
    await client.query('BEGIN');

    // 1. Handle venue (create if doesn't exist)
    let venueId = null;
    if (jsonEvent.location) {
      const venueResult = await client.query(
        'SELECT id FROM venues WHERE name = $1',
        [jsonEvent.location]
      );

      if (venueResult.rows.length === 0) {
        // Create new venue
        const newVenue = await client.query(`
          INSERT INTO venues (name, slug, city, active, created_at)
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
          RETURNING id
        `, [
          jsonEvent.location,
          generateSlug(jsonEvent.location),
          jsonEvent.location // Assuming location is city for now
        ]);
        venueId = newVenue.rows[0].id;
        console.log(`Created venue: ${jsonEvent.location}`);
      } else {
        venueId = venueResult.rows[0].id;
      }
    }

    // 2. Handle artist (create if doesn't exist)
    let artistId = null;
    if (jsonEvent.artist) {
      const artistResult = await client.query(
        'SELECT id FROM artists WHERE name = $1',
        [jsonEvent.artist]
      );

      if (artistResult.rows.length === 0) {
        // Create new artist
        const newArtist = await client.query(`
          INSERT INTO artists (name, slug, genre, active, created_at)
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
          RETURNING id
        `, [
          jsonEvent.artist,
          generateSlug(jsonEvent.artist),
          jsonEvent.genre || null
        ]);
        artistId = newArtist.rows[0].id;
        console.log(`Created artist: ${jsonEvent.artist}`);
      } else {
        artistId = artistResult.rows[0].id;
      }
    }

    // 3. Create event
    const eventResult = await client.query(`
      INSERT INTO events (
        slug, title, description, start_date, venue_id, event_type, genre,
        ticket_price, rsvp_url, instagram_handle, twitter_handle, facebook_url,
        linkedin_url, blog_content, status, featured, source_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id
    `, [
      jsonEvent.slug,
      jsonEvent.title,
      jsonEvent.description,
      jsonEvent.date, // start_date
      venueId,
      'concert', // default event_type
      jsonEvent.genre,
      jsonEvent.ticketPrice,
      jsonEvent.rsvp,
      jsonEvent.instagram,
      jsonEvent.x, // twitter
      jsonEvent.facebook,
      jsonEvent.linkedin,
      jsonEvent.blog,
      'published', // status - existing events are published
      jsonEvent.featured || false,
      'manual' // source_type
    ]);

    const eventId = eventResult.rows[0].id;

    // 4. Link artist to event
    if (artistId) {
      await client.query(`
        INSERT INTO event_artists (event_id, artist_id, role, order_index)
        VALUES ($1, $2, 'performer', 0)
      `, [eventId, artistId]);
    }

    // 5. Handle tags
    if (jsonEvent.tags && Array.isArray(jsonEvent.tags)) {
      for (const tagName of jsonEvent.tags) {
        // Find or create tag
        let tagResult = await client.query(
          'SELECT id FROM tags WHERE name = $1',
          [tagName]
        );

        let tagId;
        if (tagResult.rows.length === 0) {
          // Create new tag
          const newTag = await client.query(`
            INSERT INTO tags (name, slug, created_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            RETURNING id
          `, [tagName, generateSlug(tagName)]);
          tagId = newTag.rows[0].id;
        } else {
          tagId = tagResult.rows[0].id;
        }

        // Link tag to event
        await client.query(`
          INSERT INTO event_tags (event_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [eventId, tagId]);
      }
    }

    await client.query('COMMIT');
    console.log(`Migrated event: ${jsonEvent.title}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to migrate event ${jsonEvent.title}:`, error.message);
  }
}

/**
 * Generate URL-friendly slug from text
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sample script to insert common event sources for monitoring
 */
async function insertSampleSources() {
  const { Client } = await import('pg');
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    
    const sampleSources = [
      {
        name: 'Blue Note Cafe Events',
        url: 'https://bluenotecafe.com/events',
        source_type: 'venue_website',
        css_selectors: {
          event_list: '.event-item',
          title: '.event-title',
          date: '.event-date',
          description: '.event-description'
        }
      },
      {
        name: 'The Warehouse Events',
        url: 'https://thewarehouse.com/calendar',
        source_type: 'venue_website',
        css_selectors: {
          event_list: '.calendar-event',
          title: 'h3',
          date: '.date',
          artist: '.artist-name'
        }
      },
      {
        name: 'Albany Music Scene Facebook',
        url: 'https://facebook.com/albanymusicscene',
        source_type: 'facebook_page',
        api_config: {
          page_id: 'albanymusicscene',
          access_token: 'YOUR_FACEBOOK_ACCESS_TOKEN'
        }
      }
    ];

    for (const source of sampleSources) {
      await client.query(`
        INSERT INTO event_sources (
          name, url, source_type, css_selectors, api_config, 
          scrape_frequency, active, created_at
        ) VALUES ($1, $2, $3, $4, $5, 1440, true, CURRENT_TIMESTAMP)
      `, [
        source.name,
        source.url,
        source.source_type,
        JSON.stringify(source.css_selectors || {}),
        JSON.stringify(source.api_config || {})
      ]);
    }

    console.log('Sample event sources inserted');
    
  } catch (error) {
    console.error('Failed to insert sample sources:', error);
  } finally {
    await client.end();
  }
}

// Export functions for use in other scripts
export { migrateEvents, insertSampleSources };

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting migration...');
  console.log('Make sure to:');
  console.log('1. Install PostgreSQL and create database');
  console.log('2. Run schema.sql to create tables');
  console.log('3. Update DB_CONFIG with your database credentials');
  console.log('4. Install pg package: npm install pg');
  console.log('');
  
  // Uncomment these lines when ready to run migration
  // await migrateEvents();
  // await insertSampleSources();
} 