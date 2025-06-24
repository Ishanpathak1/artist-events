import type { APIRoute } from 'astro';
import { Pool } from 'pg';

// Database connection
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
  'postgresql://ishanpathak@localhost:5432/artist_events';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to parse cookies
function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  
  return null;
}

// Helper function to validate session and get user
async function validateSession(sessionToken: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT u.id, u.name, u.user_type 
      FROM users u 
      JOIN user_sessions s ON u.id = s.user_id 
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `, [sessionToken]);
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const client = await pool.connect();
  
  try {
    // Check authentication
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response('Authentication required', { status: 401 });
    }

    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response('Authentication required', { status: 401 });
    }

    const user = await validateSession(sessionToken);
    if (!user) {
      return new Response('Invalid session', { status: 401 });
    }

    const formData = await request.formData();
    
    // Extract form data
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const date = formData.get('date') as string;
    const location = formData.get('location') as string;
    const description = formData.get('description') as string;
    const genre = formData.get('genre') as string;
    const ticketPrice = formData.get('ticketPrice') as string;
    const rsvp = formData.get('rsvp') as string;
    const blog = formData.get('blog') as string;
    const instagram = formData.get('instagram') as string;
    const x = formData.get('x') as string;
    const linkedin = formData.get('linkedin') as string;
    const tagsString = formData.get('tags') as string;

    // Validate required fields
    if (!title || !artist || !date || !location || !description || !genre) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Parse tags from JSON string
    let tags: string[] = [];
    if (tagsString) {
      try {
        tags = JSON.parse(tagsString);
      } catch (e) {
        // If JSON parsing fails, treat as empty array
        tags = [];
      }
    }

    // Create slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .trim() || 'event'; // Fallback if slug is empty

    await client.query('BEGIN');

    // Check if slug exists and make it unique
    let finalSlug = slug;
    let counter = 1;
    while (true) {
      const existingEvent = await client.query(
        'SELECT id FROM events WHERE slug = $1',
        [finalSlug]
      );
      
      if (existingEvent.rows.length === 0) {
        break; // Slug is unique
      }
      
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    // Find or create venue
    let venueId = null;
    if (location && location.trim()) {
      // Try to find existing venue
      const existingVenue = await client.query(
        'SELECT id FROM venues WHERE LOWER(name) = LOWER($1)',
        [location.trim()]
      );
      
      if (existingVenue.rows.length > 0) {
        venueId = existingVenue.rows[0].id;
      } else {
        // Create new venue
        const newVenue = await client.query(
          'INSERT INTO venues (name, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
          [location.trim()]
        );
        venueId = newVenue.rows[0].id;
      }
    }

    // Find or create artist
    let artistId = null;
    if (artist && artist.trim()) {
      const existingArtist = await client.query(
        'SELECT id FROM artists WHERE LOWER(name) = LOWER($1)',
        [artist.trim()]
      );
      
      if (existingArtist.rows.length > 0) {
        artistId = existingArtist.rows[0].id;
      } else {
        // Create new artist
        const newArtist = await client.query(
          'INSERT INTO artists (name, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
          [artist.trim()]
        );
        artistId = newArtist.rows[0].id;
      }
    }

    // Create event
    const eventResult = await client.query(`
      INSERT INTO events (
        slug, title, description, start_date, venue_id, event_type, genre,
        ticket_price, rsvp_url, instagram_handle, twitter_handle, linkedin_url,
        blog_content, status, featured, source_type, created_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id
    `, [
      finalSlug,
      title,
      description,
      date, // start_date
      venueId,
      'concert', // default event_type
      genre,
      ticketPrice || null,
      rsvp || null,
      instagram || null,
      x || null, // twitter_handle
      linkedin || null,
      blog || null,
      'published', // status - new events are published
      false, // featured
      'submitted', // source_type
      user.id // created_by
    ]);

    const eventId = eventResult.rows[0].id;

    // Link artist to event
    if (artistId) {
      await client.query(`
        INSERT INTO event_artists (event_id, artist_id, role, order_index)
        VALUES ($1, $2, 'performer', 0)
      `, [eventId, artistId]);
    }

    // Add tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        if (tagName && tagName.trim()) {
          // Find or create tag
          let tagResult = await client.query(
            'SELECT id FROM tags WHERE LOWER(name) = LOWER($1)',
            [tagName.trim()]
          );
          
          let tagId;
          if (tagResult.rows.length > 0) {
            tagId = tagResult.rows[0].id;
          } else {
            // Create new tag
            const newTag = await client.query(
              'INSERT INTO tags (name, created_at) VALUES ($1, CURRENT_TIMESTAMP) RETURNING id',
              [tagName.trim()]
            );
            tagId = newTag.rows[0].id;
          }
          
          // Link tag to event
          await client.query(`
            INSERT INTO event_tags (event_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [eventId, tagId]);
        }
      }
    }

    await client.query('COMMIT');

    // Redirect to the new event page
    return redirect(`/events/${finalSlug}`, 302);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 });
  } finally {
    client.release();
  }
}; 