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

export async function GET({ params, request }) {
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
    
    // Get user details with activity count
    const userResult = await client.query(`
      SELECT 
        u.*,
        COUNT(DISTINCT e.id) as events_count,
        COUNT(DISTINCT bp.id) as blog_posts_count,
        MAX(COALESCE(e.created_at, bp.created_at, u.created_at)) as last_activity
      FROM users u
      LEFT JOIN events e ON u.id = e.created_by
      LEFT JOIN blog_posts bp ON u.id = bp.author_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (userResult.rows.length === 0) {
      client.release();
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = userResult.rows[0];
    
    // Remove sensitive data
    delete user.password_hash;
    
    client.release();

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT({ params, request }) {
  try {
    // Check admin authorization
    if (!(await isAdmin(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = params.id;
    const body = await request.json();
    const { name, email, user_type } = body;

    if (!name || !email || !user_type) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();
    
    // Update user
    const updateResult = await client.query(`
      UPDATE users 
      SET name = $1, email = $2, user_type = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, email, user_type, created_at, updated_at
    `, [name, email, user_type, userId]);

    if (updateResult.rows.length === 0) {
      client.release();
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    client.release();

    return new Response(JSON.stringify({ 
      message: 'User updated successfully',
      user: updateResult.rows[0]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE({ params, request }) {
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
    
    // Instead of deleting, we'll ban the user permanently
    const banResult = await client.query(`
      UPDATE users 
      SET banned_at = NOW(), ban_reason = 'Account deleted by admin'
      WHERE id = $1
      RETURNING id
    `, [userId]);

    if (banResult.rows.length === 0) {
      client.release();
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    client.release();

    return new Response(JSON.stringify({ 
      message: 'User account disabled successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 