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

function apiError(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
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

// Authenticate user from request
async function authenticateUser(request) {
    try {
        // Get session token from cookie
        const cookies = request.headers.get('cookie');
        if (!cookies) {
            return { user: null, authenticated: false };
        }
        
        const sessionToken = parseCookie(cookies, 'session_token');
        if (!sessionToken) {
            return { user: null, authenticated: false };
        }
        
        // Validate session
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
            return { user: null, authenticated: false };
        }
        
        const user = result.rows[0];
        
        return {
            user,
            authenticated: !!user,
            sessionToken: user ? sessionToken : null
        };
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return { user: null, authenticated: false };
    }
}

// Logout user
async function logoutUser(sessionToken) {
    try {
        await pool.query(`
            DELETE FROM user_sessions 
            WHERE session_token = $1
        `, [sessionToken]);
        
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}

// Clear authentication cookie
function clearAuthCookie(response, secure = false) {
    const cookieValue = `session_token=; ` +
        `Max-Age=0; ` +
        `Path=/; ` +
        `SameSite=lax; ` +
        `HttpOnly; ` +
        (secure ? 'Secure; ' : '');
    
    response.headers.set('Set-Cookie', cookieValue);
}

export async function POST({ request }) {
    try {
        // Get current session
        const auth = await authenticateUser(request);
        
        if (!auth.authenticated) {
            return apiError('Not logged in', 401);
        }
        
        // Logout user (clear session from database)
        await logoutUser(auth.sessionToken);
        
        // Create response
        const response = apiResponse({
            success: true,
            message: 'Logged out successfully'
        });
        
        // Clear authentication cookie
        const isSecure = request.url.startsWith('https://');
        clearAuthCookie(response, isSecure);
        
        return response;
        
    } catch (error) {
        console.error('Logout error:', error);
        return apiError('Logout failed', 500);
    }
} 