import { Pool } from 'pg';

// Database connection
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
  'postgresql://ishanpathak@localhost:5432/artist_events';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

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

export async function GET({ request }) {
  try {
    // Verify admin authentication
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const client = await pool.connect();
    try {
      const sessionResult = await client.query(
        'SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = $1 AND s.expires_at > NOW()',
        [sessionToken]
      );

      if (sessionResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const currentUser = sessionResult.rows[0];
      const isAdmin = currentUser.user_type === 'admin' || currentUser.role === 'admin';

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get recent broadcasts
      const result = await client.query(`
        SELECT 
          ab.id,
          ab.subject,
          ab.broadcast_type,
          ab.recipient_type,
          ab.recipient_count,
          ab.sent_count,
          ab.failed_count,
          ab.status,
          ab.sent_at,
          ab.created_at,
          COALESCE(
            CASE 
              WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL 
              THEN u.first_name || ' ' || u.last_name
              WHEN u.name IS NOT NULL 
              THEN u.name
              ELSE u.email
            END, 
            u.email
          ) as admin_username
        FROM admin_broadcasts ab
        JOIN users u ON ab.admin_id = u.id
        ORDER BY ab.created_at DESC
        LIMIT 20
      `);

      return new Response(JSON.stringify(result.rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching recent broadcasts:', error);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 