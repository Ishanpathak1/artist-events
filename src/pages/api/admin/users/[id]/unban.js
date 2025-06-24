import { Pool } from 'pg';

// Helper function to parse cookies
function parseCookie(cookieString, name) {
  if (!cookieString) return null;
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

// Admin check function
async function isAdmin(request) {
  const cookies = request.headers.get('cookie');
  if (!cookies) return false;

  const sessionToken = parseCookie(cookies, 'session_token');
  if (!sessionToken) return false;

  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
    'postgresql://ishanpathak@localhost:5432/artist_events';
  
  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const client = await pool.connect();
    const sessionResult = await client.query(
      'SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = $1 AND s.expires_at > NOW()',
      [sessionToken]
    );
    
    if (sessionResult.rows.length > 0) {
      const user = sessionResult.rows[0];
      const isAdminUser = user.email === 'ishan.pathak2711@gmail.com' || 
                         user.user_type === 'admin' || 
                         user.is_super_admin === true;
      client.release();
      return isAdminUser;
    }
    client.release();
    return false;
  } catch (error) {
    console.error('Admin check error:', error);
    return false;
  }
}

export async function POST({ params, request }) {
  try {
    // Check admin authorization
    if (!(await isAdmin(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = params.id;
    
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    
    // Unban the user
    const unbanResult = await client.query(`
      UPDATE users 
      SET banned_at = NULL, ban_reason = NULL
      WHERE id = $1 AND banned_at IS NOT NULL
      RETURNING id, name, email
    `, [userId]);

    if (unbanResult.rows.length === 0) {
      client.release();
      return new Response(JSON.stringify({ error: 'User not found or not banned' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    client.release();

    return new Response(JSON.stringify({ 
      message: 'User unbanned successfully',
      user: unbanResult.rows[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error unbanning user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 