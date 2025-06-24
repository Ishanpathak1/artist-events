import { Pool } from 'pg';

// Helper function to parse cookies
function parseCookie(cookieString, name) {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

// Admin authentication helper
async function checkAdminAuth(request) {
  const cookies = request.headers.get('cookie');
  if (!cookies) return null;

  const sessionToken = parseCookie(cookies, 'session_token');
  if (!sessionToken) return null;

  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
    'postgresql://ishanpathak@localhost:5432/artist_events';

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = $1 AND s.expires_at > NOW()',
      [sessionToken]
    );
    
    client.release();
    
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    const isAdmin = user.email === 'ishan.pathak2711@gmail.com' || 
                   user.user_type === 'admin' || 
                   user.is_super_admin === true;
    
    return isAdmin ? user : null;
  } catch (error) {
    console.error('Admin auth error:', error);
    return null;
  }
}

// GET - Get event details
export async function GET({ params, request }) {
  try {
    const admin = await checkAdminAuth(request);
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const eventId = params.id;
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          e.*,
          u.name as creator_name,
          u.email as creator_email,
          v.name as venue_name,
          v.address as venue_address
        FROM events e 
        JOIN users u ON e.created_by = u.id 
        LEFT JOIN venues v ON e.venue_id = v.id 
        WHERE e.id = $1
      `, [eventId]);

      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(result.rows[0]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Get event error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// PUT - Update event
export async function PUT({ params, request }) {
  try {
    const admin = await checkAdminAuth(request);
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const eventId = params.id;
    const data = await request.json();
    
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    try {
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query based on provided fields
      if (data.title) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(data.title);
      }
      if (data.description) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.status) {
        updateFields.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.event_date) {
        updateFields.push(`event_date = $${paramCount++}`);
        values.push(data.event_date);
      }
      if (data.ticket_price !== undefined) {
        updateFields.push(`ticket_price = $${paramCount++}`);
        values.push(data.ticket_price);
      }

      if (updateFields.length === 0) {
        return new Response(JSON.stringify({ error: 'No fields to update' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(eventId);

      const query = `
        UPDATE events 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        event: result.rows[0] 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Update event error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Delete event
export async function DELETE({ params, request }) {
  try {
    const admin = await checkAdminAuth(request);
    if (!admin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const eventId = params.id;
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    try {
      // Check if event exists
      const checkResult = await client.query('SELECT id FROM events WHERE id = $1', [eventId]);
      
      if (checkResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Event not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Delete related records first (due to foreign key constraints)
      await client.query('DELETE FROM event_tags WHERE event_id = $1', [eventId]);
      await client.query('DELETE FROM event_likes WHERE event_id = $1', [eventId]);
      
      // Delete the event
      const result = await client.query('DELETE FROM events WHERE id = $1 RETURNING *', [eventId]);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Event deleted successfully',
        deletedEvent: result.rows[0]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Delete event error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 