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

export async function GET({ request }) {
  try {
    // Get session token from cookie
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response(JSON.stringify({ 
        error: 'No cookies found',
        debug: 'User not logged in'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response(JSON.stringify({ 
        error: 'No session token found',
        debug: 'Session token missing'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate session and get user info
    const result = await pool.query(`
      SELECT 
        u.id, u.email, u.name, u.user_type, u.active, u.profile_completed,
        s.expires_at, s.last_activity
      FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `, [sessionToken]);
    
    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid session',
        debug: 'Session expired or invalid'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const user = result.rows[0];
    
    // Get all users with admin type
    const adminCheck = await pool.query(`
      SELECT id, email, user_type, active 
      FROM users 
      WHERE user_type = 'admin' OR user_type ILIKE '%admin%'
    `);

    return new Response(JSON.stringify({
      success: true,
      currentUser: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        active: user.active,
        isAdmin: user.user_type === 'admin'
      },
      allAdmins: adminCheck.rows,
      debug: {
        sessionValid: true,
        userType: user.user_type,
        adminCheck: user.user_type === 'admin' ? 'PASS' : 'FAIL'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Admin status check error:', error);
    return new Response(JSON.stringify({ 
      error: 'Database error',
      debug: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 