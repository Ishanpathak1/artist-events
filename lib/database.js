/**
 * Database utility functions for Artist Events application
 * Handles PostgreSQL connections and common operations
 */

import { Client, Pool } from 'pg';

// Database configuration - use environment variables in production
const DB_CONFIG = (() => {
  // If NEON_DATABASE_URL is provided, use it directly
  if (process.env.NEON_DATABASE_URL) {
    return {
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    };
  }
  
  // If DATABASE_URL is provided (standard for many hosting platforms)
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }
  
  // Fall back to individual connection parameters (local development)
  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'artist_events',
    user: process.env.DB_USER || 'ishanpathak',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
})();

// Connection pool for better performance
const pool = new Pool(DB_CONFIG);

// Export the pool for use in other modules
export { pool };

/**
 * Execute a query with connection pooling
 */
export async function query(text, params = []) {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Get all published events with venue and artist information
 */
export async function getPublishedEvents() {
  const result = await query(`
    SELECT 
      e.id, e.slug, e.title, e.description, 
      e.start_date, e.end_date, e.start_time, e.end_time,
      e.event_type, e.genre, e.ticket_price, e.rsvp_url,
      e.featured, e.image_url,
      v.name as venue_name, v.city as venue_city,
      ARRAY_AGG(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as artists,
      ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN event_artists ea ON e.id = ea.event_id
    LEFT JOIN artists a ON ea.artist_id = a.id
    LEFT JOIN event_tags et ON e.id = et.event_id
    LEFT JOIN tags t ON et.tag_id = t.id
    WHERE e.status = 'published'
    GROUP BY e.id, v.name, v.city
    ORDER BY e.start_date ASC, e.start_time ASC
  `);
  
  return result.rows;
}

/**
 * Get event by slug with full details
 */
export async function getEventBySlug(slug) {
  const result = await query(`
    SELECT 
      e.*, 
      v.name as venue_name, v.address, v.city as venue_city, 
      v.website_url as venue_website,
      ARRAY_AGG(DISTINCT jsonb_build_object(
        'name', a.name, 
        'role', ea.role,
        'order', ea.order_index
      )) FILTER (WHERE a.name IS NOT NULL) as artists,
      ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN event_artists ea ON e.id = ea.event_id
    LEFT JOIN artists a ON ea.artist_id = a.id OR ea.artist_name = a.name
    LEFT JOIN event_tags et ON e.id = et.event_id
    LEFT JOIN tags t ON et.tag_id = t.id
    WHERE e.slug = $1 AND e.status = 'published'
    GROUP BY e.id, v.name, v.address, v.city, v.website_url
  `, [slug]);
  
  return result.rows[0] || null;
}

/**
 * Search events with filters
 */
export async function searchEvents(filters = {}) {
  let whereConditions = ["e.status = 'published'"];
  let params = [];
  let paramCount = 0;

  // Text search
  if (filters.query) {
    paramCount++;
    whereConditions.push(`(
      to_tsvector('english', e.title) @@ plainto_tsquery('english', $${paramCount})
      OR to_tsvector('english', e.description) @@ plainto_tsquery('english', $${paramCount})
      OR to_tsvector('english', a.name) @@ plainto_tsquery('english', $${paramCount})
    )`);
    params.push(filters.query);
  }

  // Genre filter
  if (filters.genre) {
    paramCount++;
    whereConditions.push(`e.genre = $${paramCount}`);
    params.push(filters.genre);
  }

  // Date filter
  if (filters.date_from) {
    paramCount++;
    whereConditions.push(`e.start_date >= $${paramCount}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    paramCount++;
    whereConditions.push(`e.start_date <= $${paramCount}`);
    params.push(filters.date_to);
  }

  // Venue filter
  if (filters.venue_id) {
    paramCount++;
    whereConditions.push(`e.venue_id = $${paramCount}`);
    params.push(filters.venue_id);
  }

  const whereClause = whereConditions.join(' AND ');

  const result = await query(`
    SELECT DISTINCT
      e.id, e.slug, e.title, e.description, 
      e.start_date, e.end_date, e.start_time, e.end_time,
      e.event_type, e.genre, e.ticket_price, e.featured,
      v.name as venue_name, v.city as venue_city,
      ARRAY_AGG(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as artists,
      ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN event_artists ea ON e.id = ea.event_id
    LEFT JOIN artists a ON ea.artist_id = a.id
    LEFT JOIN event_tags et ON e.id = et.event_id
    LEFT JOIN tags t ON et.tag_id = t.id
    WHERE ${whereClause}
    GROUP BY e.id, v.name, v.city
    ORDER BY e.start_date ASC, e.start_time ASC
    LIMIT ${filters.limit || 50}
  `, params);

  return result.rows;
}

/**
 * Get all venues for dropdown/filter options
 */
export async function getVenues() {
  const result = await query(`
    SELECT id, name, city
    FROM venues 
    WHERE active = true
    ORDER BY name
  `);
  return result.rows;
}

/**
 * Get all artists for dropdown/filter options
 */
export async function getArtists() {
  const result = await query(`
    SELECT id, name, genre
    FROM artists 
    WHERE active = true
    ORDER BY name
  `);
  return result.rows;
}

/**
 * Get all tags for filter options
 */
export async function getTags() {
  const result = await query(`
    SELECT id, name, slug, color
    FROM tags 
    ORDER BY name
  `);
  return result.rows;
}

/**
 * Create a new event (for submissions and manual entry)
 */
export async function createEvent(eventData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert main event
    const eventResult = await client.query(`
      INSERT INTO events (
        slug, title, description, start_date, end_date, start_time, end_time,
        venue_id, custom_location, event_type, genre, ticket_price, 
        rsvp_url, blog_content, status, featured, source_type, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING id
    `, [
      eventData.slug,
      eventData.title,
      eventData.description,
      eventData.start_date,
      eventData.end_date,
      eventData.start_time,
      eventData.end_time,
      eventData.venue_id,
      eventData.custom_location,
      eventData.event_type || 'concert',
      eventData.genre,
      eventData.ticket_price,
      eventData.rsvp_url,
      eventData.blog_content,
      eventData.status || 'draft',
      eventData.featured || false,
      eventData.source_type || 'manual',
      eventData.created_by
    ]);

    const eventId = eventResult.rows[0].id;

    // Add artists
    if (eventData.artists && eventData.artists.length > 0) {
      for (let i = 0; i < eventData.artists.length; i++) {
        const artist = eventData.artists[i];
        await client.query(`
          INSERT INTO event_artists (event_id, artist_id, artist_name, role, order_index)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          eventId,
          artist.id || null,
          artist.name,
          artist.role || 'performer',
          i
        ]);
      }
    }

    // Add tags
    if (eventData.tags && eventData.tags.length > 0) {
      for (const tagId of eventData.tags) {
        await client.query(`
          INSERT INTO event_tags (event_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [eventId, tagId]);
      }
    }

    await client.query('COMMIT');
    return eventId;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get events pending moderation
 */
export async function getPendingEvents() {
  const result = await query(`
    SELECT 
      e.id, e.slug, e.title, e.start_date, e.source_type,
      e.created_at, v.name as venue_name,
      ARRAY_AGG(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as artists
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    LEFT JOIN event_artists ea ON e.id = ea.event_id
    LEFT JOIN artists a ON ea.artist_id = a.id
    WHERE e.status = 'pending'
    GROUP BY e.id, v.name
    ORDER BY e.created_at DESC
  `);
  
  return result.rows;
}

/**
 * Update event status (for moderation)
 */
export async function updateEventStatus(eventId, status, moderatorId, notes = null) {
  await query(`
    UPDATE events 
    SET status = $1, moderated_by = $2, moderated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [status, moderatorId, eventId]);

  // Log the change
  await query(`
    INSERT INTO event_history (event_id, changed_by, change_type, notes)
    VALUES ($1, $2, $3, $4)
  `, [eventId, moderatorId, `status_changed_to_${status}`, notes]);
}

/**
 * Get event sources for monitoring
 */
export async function getEventSources() {
  const result = await query(`
    SELECT es.*, v.name as venue_name, a.name as artist_name
    FROM event_sources es
    LEFT JOIN venues v ON es.venue_id = v.id
    LEFT JOIN artists a ON es.artist_id = a.id
    WHERE es.active = true
    ORDER BY es.name
  `);
  
  return result.rows;
}

/**
 * Close database connection pool
 */
export async function closePool() {
  await pool.end();
}

// Helper function to generate unique slugs
export function generateSlug(title, existingSlugs = []) {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  let slug = baseSlug;
  let counter = 1;
  
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
} 