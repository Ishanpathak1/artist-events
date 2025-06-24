import { Pool } from 'pg';

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

// API response helpers
function apiResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

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

// Validate session and get user
async function validateSession(sessionToken) {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, u.email, u.name, u.user_type, u.active, u.profile_completed,
                u.avatar_url, u.bio, u.location, u.website_url, u.social_links,
                s.expires_at, s.last_activity
            FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `, [sessionToken]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const user = result.rows[0];
        
        // Update last activity
        await pool.query(`
            UPDATE user_sessions 
            SET last_activity = CURRENT_TIMESTAMP
            WHERE session_token = $1
        `, [sessionToken]);
        
        return user;
    } catch (error) {
        console.error('Session validation error:', error);
        return null;
    }
}

export async function GET({ request }) {
    try {
        // Get session token from cookie
        const cookies = request.headers.get('cookie');
        if (!cookies) {
            return apiResponse({ user: null, authenticated: false });
        }
        
        const sessionToken = parseCookie(cookies, 'session_token');
        if (!sessionToken) {
            return apiResponse({ user: null, authenticated: false });
        }
        
        // Validate session
        const user = await validateSession(sessionToken);
        
        if (!user) {
            return apiResponse({ user: null, authenticated: false });
        }
        
        // Remove sensitive data
        delete user.password_hash;
        delete user.email_verification_token;
        delete user.password_reset_token;
        
        return apiResponse({
            user,
            authenticated: true
        });
        
    } catch (error) {
        console.error('Session validation error:', error);
        return apiResponse({ user: null, authenticated: false });
    }
} 