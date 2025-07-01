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



export async function GET({ request }) {
    try {
        // Get session token from cookie - using working auth/validate pattern
        const cookies = request.headers.get('cookie');
        if (!cookies) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'No cookies found',
                stats: {
                    followers: 0,
                    followersCount: 0,
                    followingCount: 0,
                    events: { total_events: 0 },
                    blogs: { total_posts: 0 },
                    eventLikes: 0
                }
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const sessionToken = parseCookie(cookies, 'session_token');
        if (!sessionToken) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'No session token',
                stats: {
                    followers: 0,
                    followersCount: 0,
                    followingCount: 0,
                    events: { total_events: 0 },
                    blogs: { total_posts: 0 },
                    eventLikes: 0
                }
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate session using same logic as auth/validate
        const result = await pool.query(`
            SELECT 
                u.id, u.email, u.name, u.user_type, u.active, u.profile_completed,
                u.avatar_url, u.bio, u.location, u.website_url, u.social_links,
                u.created_at
            FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
        `, [sessionToken]);
        
        if (result.rows.length === 0) {
            return new Response(JSON.stringify({ 
                success: false,
                error: 'Invalid session',
                stats: {
                    followers: 0,
                    followersCount: 0,
                    followingCount: 0,
                    events: { total_events: 0 },
                    blogs: { total_posts: 0 },
                    eventLikes: 0
                }
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const user = result.rows[0];
        const client = await pool.connect();

        try {
            // Get followers count (people following this user)
            const followersResult = await client.query(`
                SELECT COUNT(*) as count
                FROM artist_subscriptions 
                WHERE artist_id = $1 AND is_subscribed = true
            `, [user.id]);

            // Get following count (artists this user follows)
            const followingResult = await client.query(`
                SELECT COUNT(*) as count
                FROM artist_subscriptions as_sub
                JOIN users u ON as_sub.artist_id = u.id
                WHERE as_sub.user_id = $1 
                  AND as_sub.is_subscribed = true 
                  AND u.user_type = 'artist'
                  AND u.active = true
            `, [user.id]);

            // Get events count (events this user created)
            const eventsResult = await client.query(`
                SELECT COUNT(*) as count
                FROM events e
                WHERE e.created_by = $1
            `, [user.id]);

            // Get blogs count (blog posts this user created)
            const blogsResult = await client.query(`
                SELECT COUNT(*) as count
                FROM blog_posts b
                WHERE b.author_id = $1
            `, [user.id]);

            // Get recent followers (for detailed lists)
            const recentFollowersResult = await client.query(`
                SELECT u.id, u.name, u.avatar_url, as_sub.subscribed_at
                FROM artist_subscriptions as_sub
                JOIN users u ON as_sub.user_id = u.id
                WHERE as_sub.artist_id = $1 AND as_sub.is_subscribed = true
                ORDER BY as_sub.subscribed_at DESC
            `, [user.id]);

            // Get recent following (for detailed lists)
            const recentFollowingResult = await client.query(`
                SELECT u.id, u.name, u.avatar_url, ap.stage_name, as_sub.subscribed_at
                FROM artist_subscriptions as_sub
                JOIN users u ON as_sub.artist_id = u.id
                LEFT JOIN artist_profiles ap ON u.id = ap.user_id
                WHERE as_sub.user_id = $1 
                  AND as_sub.is_subscribed = true 
                  AND u.user_type = 'artist'
                  AND u.active = true
                ORDER BY as_sub.subscribed_at DESC
            `, [user.id]);

            const followersCount = parseInt(followersResult.rows[0].count);
            const followingCount = parseInt(followingResult.rows[0].count);
            const eventsCount = parseInt(eventsResult.rows[0].count);
            const blogsCount = parseInt(blogsResult.rows[0].count);

            const stats = {
                success: true,
                stats: {
                    followers: followersCount,
                    followersCount: followersCount,
                    followingCount: followingCount,
                    events: { total_events: eventsCount },
                    blogs: { total_posts: blogsCount },
                    eventLikes: 0
                },
                // Include detailed lists for the followers/following pages
                allFollowers: recentFollowersResult.rows,
                allFollowing: recentFollowingResult.rows
            };

            return new Response(JSON.stringify(stats), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Stats API error:', error);
        return new Response(JSON.stringify({ 
            success: false,
            error: 'Internal server error',
            stats: {
                followers: 0,
                followersCount: 0,
                followingCount: 0,
                events: { total_events: 0 },
                blogs: { total_posts: 0 },
                eventLikes: 0
            }
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 