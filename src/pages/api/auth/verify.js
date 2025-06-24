import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration - inline with fallback
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

const pool = new Pool(DB_CONFIG);

export async function GET({ request }) {
    try {
        // Get token from Authorization header or cookie
        let token = null;
        
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        
        if (!token) {
            const cookie = request.headers.get('cookie');
            if (cookie) {
                const sessionMatch = cookie.match(/session_token=([^;]+)/);
                if (sessionMatch) {
                    token = decodeURIComponent(sessionMatch[1]);
                }
            }
        }
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'No token provided' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Verify session token
        const sessionResult = await pool.query(`
            SELECT us.user_id, us.expires_at, u.email, u.name, u.user_type, u.active, u.avatar_url
            FROM user_sessions us
            JOIN users u ON us.user_id = u.id
            WHERE us.session_token = $1 AND us.expires_at > NOW()
        `, [token]);
        
        if (sessionResult.rows.length === 0) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const user = sessionResult.rows[0];
        
        if (!user.active) {
            return new Response(JSON.stringify({ error: 'Account is deactivated' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Check if user is admin (admin can be user_type = 'admin' or email = 'ishan.pathak2711@gmail.com')
        const isAdmin = user.user_type === 'admin' || user.email === 'ishan.pathak2711@gmail.com';
        
        // Return user info
        return new Response(JSON.stringify({
            id: user.user_id,
            email: user.email,
            name: user.name,
            user_type: user.user_type,
            avatar_url: user.avatar_url,
            is_admin: isAdmin
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('Auth verification error:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 