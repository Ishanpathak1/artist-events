/**
 * Deploy database schema and data to Neon PostgreSQL
 * Run this after creating your Neon database
 */

import fs from 'fs';
import { Client } from 'pg';

// You'll replace this with your actual Neon connection string
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL || 'postgresql://username:password@ep-example.us-east-2.aws.neon.tech/dbname?sslmode=require';

async function deployToNeon() {
  console.log('🚀 Deploying to Neon PostgreSQL...');
  
  const client = new Client({
    connectionString: NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Read and execute schema
    console.log('📄 Reading schema.sql...');
    const schema = fs.readFileSync('./database/schema.sql', 'utf-8');
    
    console.log('🔧 Creating tables and indexes...');
    await client.query(schema);
    console.log('✅ Schema deployed successfully');

    // Check if we have local data to migrate
    const eventsPath = './data/events.json';
    if (fs.existsSync(eventsPath)) {
      console.log('📦 Migrating local events data...');
      
      // Import migration functions
      const { migrateEvents, insertSampleSources } = await import('./migrate-from-json.js');
      
      // Update the migration config to use Neon
      process.env.DB_HOST = new URL(NEON_DATABASE_URL).hostname;
      process.env.DB_PORT = new URL(NEON_DATABASE_URL).port;
      process.env.DB_NAME = new URL(NEON_DATABASE_URL).pathname.slice(1);
      process.env.DB_USER = new URL(NEON_DATABASE_URL).username;
      process.env.DB_PASSWORD = new URL(NEON_DATABASE_URL).password;
      
      // Run migration with Neon connection
      await migrateEventsToNeon(NEON_DATABASE_URL);
      await insertSampleSources();
      
      console.log('✅ Data migration completed');
    }

    // Verify deployment
    const result = await client.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log(`✅ Deployment complete! Created ${result.rows[0].table_count} tables`);

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function migrateEventsToNeon(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Read existing events
    const eventsData = JSON.parse(fs.readFileSync('./data/events.json', 'utf-8'));
    console.log(`📄 Found ${eventsData.length} events to migrate`);

    for (const event of eventsData) {
      await migrateEventToNeon(client, event);
    }

  } finally {
    await client.end();
  }
}

async function migrateEventToNeon(client, jsonEvent) {
  try {
    await client.query('BEGIN');

    // Handle venue
    let venueId = null;
    if (jsonEvent.location) {
      const venueResult = await client.query(
        'SELECT id FROM venues WHERE name = $1',
        [jsonEvent.location]
      );

      if (venueResult.rows.length === 0) {
        const newVenue = await client.query(`
          INSERT INTO venues (name, slug, city, active, created_at)
          VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP)
          RETURNING id
        `, [
          jsonEvent.location,
          generateSlug(jsonEvent.location),
          jsonEvent.location
        ]);
        venueId = newVenue.rows[0].id;
      } else {
        venueId = venueResult.rows[0].id;
      }
    }

    // Handle artist
    let artistId = null;
    if (jsonEvent.artist) {
      const artistResult = await client.query(
        'SELECT id FROM artists WHERE name = $1',
        [jsonEvent.artist]
      );

      if (artistResult.rows.length === 0) {
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
      } else {
        artistId = artistResult.rows[0].id;
      }
    }

    // Create event
    const eventResult = await client.query(`
      INSERT INTO events (
        slug, title, description, start_date, venue_id, event_type, genre,
        ticket_price, rsvp_url, status, featured, source_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id
    `, [
      jsonEvent.slug,
      jsonEvent.title,
      jsonEvent.description,
      jsonEvent.date,
      venueId,
      'concert',
      jsonEvent.genre,
      jsonEvent.ticketPrice,
      jsonEvent.rsvp,
      'published',
      jsonEvent.featured || false,
      'manual'
    ]);

    const eventId = eventResult.rows[0].id;

    // Link artist
    if (artistId) {
      await client.query(`
        INSERT INTO event_artists (event_id, artist_id, role, order_index)
        VALUES ($1, $2, 'performer', 0)
      `, [eventId, artistId]);
    }

    // Handle tags
    if (jsonEvent.tags && Array.isArray(jsonEvent.tags)) {
      for (const tagName of jsonEvent.tags) {
        let tagResult = await client.query(
          'SELECT id FROM tags WHERE name ILIKE $1',
          [tagName]
        );

        let tagId;
        if (tagResult.rows.length === 0) {
          const baseSlug = generateSlug(tagName);
          let finalSlug = baseSlug;
          let counter = 1;
          
          while (true) {
            const slugCheck = await client.query(
              'SELECT id FROM tags WHERE slug = $1',
              [finalSlug]
            );
            
            if (slugCheck.rows.length === 0) break;
            
            finalSlug = `${baseSlug}-${counter}`;
            counter++;
          }
          
          const newTag = await client.query(`
            INSERT INTO tags (name, slug, created_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            RETURNING id
          `, [tagName, finalSlug]);
          tagId = newTag.rows[0].id;
        } else {
          tagId = tagResult.rows[0].id;
        }

        await client.query(`
          INSERT INTO event_tags (event_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [eventId, tagId]);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migrated: ${jsonEvent.title}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Failed to migrate ${jsonEvent.title}:`, error.message);
  }
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.NEON_DATABASE_URL) {
    console.error('❌ Please set NEON_DATABASE_URL environment variable');
    console.log('Example: export NEON_DATABASE_URL="postgresql://user:pass@ep-example.us-east-2.aws.neon.tech/dbname?sslmode=require"');
    process.exit(1);
  }
  
  deployToNeon().catch(console.error);
}

export { deployToNeon }; 