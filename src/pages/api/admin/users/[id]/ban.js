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
    let banReason = 'Banned by admin';
    
    // Try to get ban reason from request body
    try {
      const body = await request.json();
      if (body.reason) {
        banReason = body.reason;
      }
    } catch {
      // If no body or invalid JSON, use default reason
    }
    
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    
    // Ban the user
    const banResult = await client.query(`
      UPDATE users 
      SET banned_at = NOW(), ban_reason = $1
      WHERE id = $2 AND banned_at IS NULL
      RETURNING id, name, email, banned_at
    `, [banReason, userId]);

    if (banResult.rows.length === 0) {
      client.release();
      return new Response(JSON.stringify({ error: 'User not found or already banned' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Also invalidate all user sessions
    await client.query(
      'DELETE FROM user_sessions WHERE user_id = $1',
      [userId]
    );

    client.release();

    return new Response(JSON.stringify({ 
      message: 'User banned successfully',
      user: banResult.rows[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error banning user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 