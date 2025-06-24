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

// Super admin check function
async function isSuperAdmin(request) {
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
      // Check if user is super admin
      const isSuperAdminUser = user.email === 'ishan.pathak2711@gmail.com' && user.is_super_admin === true;
      client.release();
      return isSuperAdminUser;
    }
    client.release();
    return false;
  } catch (error) {
    console.error('Super admin check error:', error);
    return false;
  }
}

// POST - Grant admin access
export async function POST({ request }) {
  try {
    // Check if user is super admin
    if (!(await isSuperAdmin(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email, permissions = [] } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user exists
      const userResult = await client.query(
        'SELECT id, email, user_type FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = userResult.rows[0];

      // Update user to admin
      await client.query(
        'UPDATE users SET user_type = $1 WHERE id = $2',
        ['admin', user.id]
      );

      // If specific permissions are provided, grant them
      if (permissions.length > 0) {
        // Remove existing permissions
        await client.query(
          'DELETE FROM user_admin_permissions WHERE user_id = $1',
          [user.id]
        );

        // Add new permissions
        for (const permissionName of permissions) {
          const permResult = await client.query(
            'SELECT id FROM admin_permissions WHERE name = $1',
            [permissionName]
          );

          if (permResult.rows.length > 0) {
            await client.query(
              'INSERT INTO user_admin_permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [user.id, permResult.rows[0].id]
            );
          }
        }
      }

      await client.query('COMMIT');

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Admin access granted to ${email}` 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Grant admin access error:', error);
    return new Response(JSON.stringify({ error: 'Failed to grant admin access' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// DELETE - Revoke admin access
export async function DELETE({ request, url }) {
  try {
    // Check if user is super admin
    if (!(await isSuperAdmin(request))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const email = url.searchParams.get('email');

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Don't allow revoking super admin access
    if (email === 'ishan.pathak2711@gmail.com') {
      return new Response(JSON.stringify({ error: 'Cannot revoke super admin access' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
      'postgresql://ishanpathak@localhost:5432/artist_events';
    
    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if user exists
      const userResult = await client.query(
        'SELECT id, email, user_type, is_super_admin FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = userResult.rows[0];

      // Don't allow revoking super admin
      if (user.is_super_admin) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({ error: 'Cannot revoke super admin access' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update user back to their original type (audience by default)
      await client.query(
        'UPDATE users SET user_type = $1 WHERE id = $2',
        ['audience', user.id]
      );

      // Remove all admin permissions
      await client.query(
        'DELETE FROM user_admin_permissions WHERE user_id = $1',
        [user.id]
      );

      // Invalidate all sessions for this user
      await client.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [user.id]
      );

      await client.query('COMMIT');

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Admin access revoked from ${email}` 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Revoke admin access error:', error);
    return new Response(JSON.stringify({ error: 'Failed to revoke admin access' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get admin users list
export async function GET({ request }) {
  try {
    const { isSuper } = await isSuperAdmin(request);
    
    if (!isSuper) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Only super admin can view admin users.' }), {
        status: 401,
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
    
    // Get all admin users with their permissions
    const adminUsers = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.user_type,
        u.is_super_admin,
        u.created_at,
        COALESCE(
          ARRAY_AGG(p.name ORDER BY p.name) FILTER (WHERE p.name IS NOT NULL),
          '{}'
        ) as permissions
      FROM users u
      LEFT JOIN user_admin_permissions uap ON u.id = uap.user_id
      LEFT JOIN admin_permissions p ON uap.permission_id = p.id
      WHERE u.user_type = 'admin'
      GROUP BY u.id, u.email, u.name, u.user_type, u.is_super_admin, u.created_at
      ORDER BY u.is_super_admin DESC, u.created_at ASC
    `);

    client.release();

    return new Response(JSON.stringify({ 
      adminUsers: adminUsers.rows
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching admin users:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 