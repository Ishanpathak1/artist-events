import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from './database.js';

// Session configuration
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Password utilities
export async function hashPassword(password) {
    return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Generate secure random tokens
export function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// User registration
export async function registerUser(userData) {
    const { email, password, name, userType = 'audience' } = userData;
    
    try {
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );
        
        if (existingUser.rows.length > 0) {
            throw new Error('User with this email already exists');
        }
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Create user
        const result = await pool.query(`
            INSERT INTO users (email, password_hash, name, user_type, email_verification_token)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, name, user_type, profile_completed, created_at
        `, [email, passwordHash, name, userType, generateToken()]);
        
        const user = result.rows[0];
        
        // Create artist profile if user is an artist
        if (userType === 'artist') {
            await pool.query(`
                INSERT INTO artist_profiles (user_id)
                VALUES ($1)
            `, [user.id]);
        }
        
        return user;
    } catch (error) {
        throw new Error(`Registration failed: ${error.message}`);
    }
}

// User login
export async function loginUser(email, password, request = null) {
    try {
        // Get user with password hash
        const result = await pool.query(`
            SELECT id, email, password_hash, name, user_type, active, email_verified, profile_completed
            FROM users 
            WHERE email = $1
        `, [email]);
        
        if (result.rows.length === 0) {
            throw new Error('Invalid email or password');
        }
        
        const user = result.rows[0];
        
        if (!user.active) {
            throw new Error('Account is deactivated');
        }
        
        // Verify password
        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) {
            throw new Error('Invalid email or password');
        }
        
        // Create session
        const sessionToken = generateToken();
        const expiresAt = new Date(Date.now() + SESSION_DURATION);
        
        let ipAddress = null;
        let userAgent = null;
        
        if (request) {
            ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       '127.0.0.1';
            userAgent = request.headers.get('user-agent') || '';
        }
        
        await pool.query(`
            INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at)
            VALUES ($1, $2, $3, $4, $5)
        `, [user.id, sessionToken, ipAddress, userAgent, expiresAt]);
        
        // Update login stats
        await pool.query(`
            UPDATE users 
            SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1
            WHERE id = $1
        `, [user.id]);
        
        // Remove password hash from response
        delete user.password_hash;
        
        return {
            user,
            sessionToken,
            expiresAt
        };
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

// Validate session and get user
export async function validateSession(sessionToken) {
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

// Get user with artist profile
export async function getUserWithProfile(userId) {
    try {
        const result = await pool.query(`
            SELECT 
                u.*,
                ap.stage_name, ap.genres, ap.instruments, ap.experience_level,
                ap.hourly_rate, ap.availability, ap.portfolio_images, 
                ap.demo_tracks, ap.verified_artist, ap.total_events,
                ap.total_followers, ap.average_rating, ap.featured_artist
            FROM users u
            LEFT JOIN artist_profiles ap ON u.id = ap.user_id
            WHERE u.id = $1
        `, [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const user = result.rows[0];
        delete user.password_hash;
        
        return user;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

// Logout user
export async function logoutUser(sessionToken) {
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

// Logout all sessions for a user
export async function logoutAllSessions(userId) {
    try {
        await pool.query(`
            DELETE FROM user_sessions 
            WHERE user_id = $1
        `, [userId]);
        
        return true;
    } catch (error) {
        console.error('Logout all sessions error:', error);
        return false;
    }
}

// Update user profile
export async function updateUserProfile(userId, profileData) {
    try {
        const {
            name, bio, location, website_url, social_links, avatar_url,
            // Artist-specific fields
            stage_name, genres, instruments, experience_level,
            hourly_rate, availability, booking_email, booking_phone
        } = profileData;
        
        // Update user table
        await pool.query(`
            UPDATE users 
            SET name = COALESCE($2, name),
                bio = COALESCE($3, bio),
                location = COALESCE($4, location),
                website_url = COALESCE($5, website_url),
                social_links = COALESCE($6, social_links),
                avatar_url = COALESCE($7, avatar_url),
                profile_completed = true,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [userId, name, bio, location, website_url, social_links, avatar_url]);
        
        // Update artist profile if user is an artist
        const userResult = await pool.query('SELECT user_type FROM users WHERE id = $1', [userId]);
        if (userResult.rows[0]?.user_type === 'artist') {
            await pool.query(`
                UPDATE artist_profiles 
                SET stage_name = COALESCE($2, stage_name),
                    genres = COALESCE($3, genres),
                    instruments = COALESCE($4, instruments),
                    experience_level = COALESCE($5, experience_level),
                    hourly_rate = COALESCE($6, hourly_rate),
                    availability = COALESCE($7, availability),
                    booking_email = COALESCE($8, booking_email),
                    booking_phone = COALESCE($9, booking_phone),
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
            `, [userId, stage_name, genres, instruments, experience_level, 
                hourly_rate, availability, booking_email, booking_phone]);
        }
        
        return await getUserWithProfile(userId);
    } catch (error) {
        throw new Error(`Profile update failed: ${error.message}`);
    }
}

// Change user type (audience <-> artist)
export async function changeUserType(userId, newType) {
    try {
        await pool.query('BEGIN');
        
        // Update user type
        await pool.query(`
            UPDATE users 
            SET user_type = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [userId, newType]);
        
        if (newType === 'artist') {
            // Create artist profile if switching to artist
            await pool.query(`
                INSERT INTO artist_profiles (user_id)
                VALUES ($1)
                ON CONFLICT (user_id) DO NOTHING
            `, [userId]);
        }
        
        await pool.query('COMMIT');
        return true;
    } catch (error) {
        await pool.query('ROLLBACK');
        throw new Error(`User type change failed: ${error.message}`);
    }
}

// Get user dashboard stats
export async function getUserDashboardStats(userId) {
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

// Clean up expired sessions (run periodically)
export async function cleanupExpiredSessions() {
    try {
        const result = await pool.query(`
            DELETE FROM user_sessions 
            WHERE expires_at < CURRENT_TIMESTAMP
        `);
        
        console.log(`Cleaned up ${result.rowCount} expired sessions`);
        return result.rowCount;
    } catch (error) {
        console.error('Session cleanup error:', error);
        return 0;
    }
} 