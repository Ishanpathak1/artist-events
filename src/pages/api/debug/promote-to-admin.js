import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper function to parse cookies
function parseCookie(cookieString, name) {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) return decodeURIComponent(cookieValue);
  }
  return null;
}

export async function POST({ request }) {
  try {
    // Get session token from cookie
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response(JSON.stringify({ 
        error: 'Not logged in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response(JSON.stringify({ 
        error: 'No session token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate session and get user info
    const result = await pool.query(`
      SELECT u.id, u.email, u.user_type
      FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `, [sessionToken]);
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid session'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = result.rows[0];
    
    // Only allow the specific user (you) to promote themselves
    if (user.email !== 'ishan.pathak2711@gmail.com') {
      return new Response(JSON.stringify({ 
        error: 'Not authorized to use this endpoint'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Make user an admin
    await pool.query(`
      UPDATE users 
      SET user_type = 'admin' 
      WHERE id = $1
    `, [user.id]);

    return new Response(JSON.stringify({
      success: true,
      message: `🎉 ${user.email} is now an admin!`,
      userId: user.id,
      oldUserType: user.user_type,
      newUserType: 'admin',
      note: 'You can now approve email campaigns. Please refresh your browser.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Promote to admin error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database error: ' + error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 