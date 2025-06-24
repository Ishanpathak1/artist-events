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

// Get user dashboard stats
async function getUserDashboardStats(userId) {
    try {
        const [eventsResult, blogsResult, followersResult, likesResult] = await Promise.all([
            // Events created
            pool.query(`
                SELECT COUNT(*) as total_events,
                       COUNT(CASE WHEN status = 'published' THEN 1 END) as published_events,
                       COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_events
                FROM events 
                WHERE created_by = $1
            `, [userId]),
            
            // Blog posts
            pool.query(`
                SELECT COUNT(*) as total_posts,
                       COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
                       SUM(view_count) as total_views,
                       SUM(like_count) as total_likes
                FROM blog_posts 
                WHERE author_id = $1
            `, [userId]),
            
            // Followers
            pool.query(`
                SELECT COUNT(*) as follower_count
                FROM user_follows 
                WHERE following_id = $1
            `, [userId]),
            
            // Event likes received
            pool.query(`
                SELECT COUNT(*) as event_likes
                FROM event_likes el
                JOIN events e ON el.event_id = e.id
                WHERE e.created_by = $1
            `, [userId])
        ]);
        
        return {
            events: eventsResult.rows[0],
            blogs: blogsResult.rows[0],
            followers: followersResult.rows[0].follower_count,
            eventLikes: likesResult.rows[0].event_likes
        };
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        return null;
    }
}

export async function GET({ request }) {
    try {
        const auth = await authenticateUser(request);
        
        if (!auth.authenticated) {
            return apiError('Authentication required', 401);
        }
        
        const stats = await getUserDashboardStats(auth.user.id);
        
        return apiResponse({
            success: true,
            stats,
            user: {
                id: auth.user.id,
                name: auth.user.name,
                email: auth.user.email,
                userType: auth.user.user_type,
                profileCompleted: auth.user.profile_completed,
                avatarUrl: auth.user.avatar_url
            }
        });
        
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return apiError('Failed to get dashboard stats', 500);
    }
} 