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

// Validation helpers
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

// Get user with artist profile
async function getUserWithProfile(userId) {
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

// Update user profile
async function updateUserProfile(userId, profileData) {
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
async function changeUserType(userId, newType) {
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

// Helper function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Get user profile
export async function GET({ request }) {
    try {
        const auth = await authenticateUser(request);
        
        if (!auth.authenticated) {
            return apiError('Authentication required', 401);
        }
        
        const profile = await getUserWithProfile(auth.user.id);
        
        if (!profile) {
            return apiError('Profile not found', 404);
        }
        
        // Remove sensitive data
        delete profile.password_hash;
        delete profile.email_verification_token;
        delete profile.password_reset_token;
        
        return apiResponse({
            success: true,
            profile
        });
        
    } catch (error) {
        console.error('Get profile error:', error);
        return apiError('Failed to get profile', 500);
    }
}

// Update user profile
export async function PUT({ request }) {
    try {
        const auth = await authenticateUser(request);
        
        if (!auth.authenticated) {
            return apiError('Authentication required', 401);
        }
        
        const body = await request.json();
        const {
            name, bio, location, website_url, social_links, avatar_url,
            // Artist-specific fields
            stage_name, genres, instruments, experience_level,
            hourly_rate, availability, booking_email, booking_phone
        } = body;
        
        // Validation
        if (name && (name.length < 2 || name.length > 100)) {
            return apiError('Name must be between 2 and 100 characters');
        }
        
        if (bio && bio.length > 1000) {
            return apiError('Bio must be less than 1000 characters');
        }
        
        if (website_url && !isValidUrl(website_url)) {
            return apiError('Invalid website URL');
        }
        
        if (booking_email && !validateEmail(booking_email)) {
            return apiError('Invalid booking email');
        }
        
        if (hourly_rate && (hourly_rate < 0 || hourly_rate > 10000)) {
            return apiError('Hourly rate must be between 0 and 10000');
        }
        
        // Update profile
        const updatedProfile = await updateUserProfile(auth.user.id, {
            name: name?.trim(),
            bio: bio?.trim(),
            location: location?.trim(),
            website_url: website_url?.trim(),
            social_links,
            avatar_url: avatar_url?.trim(),
            stage_name: stage_name?.trim(),
            genres,
            instruments,
            experience_level,
            hourly_rate,
            availability,
            booking_email: booking_email?.toLowerCase().trim(),
            booking_phone: booking_phone?.trim()
        });
        
        return apiResponse({
            success: true,
            message: 'Profile updated successfully',
            profile: updatedProfile
        });
        
    } catch (error) {
        console.error('Update profile error:', error);
        return apiError(error.message || 'Failed to update profile', 400);
    }
}

// Change user type (audience <-> artist)
export async function PATCH({ request }) {
    try {
        const auth = await authenticateUser(request);
        
        if (!auth.authenticated) {
            return apiError('Authentication required', 401);
        }
        
        const body = await request.json();
        const { userType } = body;
        
        if (!['audience', 'artist'].includes(userType)) {
            return apiError('Invalid user type');
        }
        
        if (auth.user.user_type === userType) {
            return apiError('User type is already set to ' + userType);
        }
        
        await changeUserType(auth.user.id, userType);
        
        return apiResponse({
            success: true,
            message: `User type changed to ${userType}`,
            userType
        });
        
    } catch (error) {
        console.error('Change user type error:', error);
        return apiError(error.message || 'Failed to change user type', 400);
    }
} 