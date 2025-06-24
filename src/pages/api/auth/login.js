import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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

// Session configuration
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

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

// Simple rate limiting (in-memory)
const rateLimitStore = new Map();

function checkRateLimit(identifier, limit = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitStore.has(identifier)) {
        rateLimitStore.set(identifier, []);
    }
    
    const requests = rateLimitStore.get(identifier);
    
    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= limit) {
        return false; // Rate limit exceeded
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimitStore.set(identifier, recentRequests);
    
    return true; // Request allowed
}

// Generate secure random tokens
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Password utilities
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// Set authentication cookie
function setAuthCookie(response, sessionToken, secure = false) {
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    const cookieValue = `session_token=${encodeURIComponent(sessionToken)}; ` +
        `Max-Age=${maxAge}; ` +
        `Path=/; ` +
        `SameSite=lax; ` +
        `HttpOnly; ` +
        (secure ? 'Secure; ' : '');
    
    response.headers.set('Set-Cookie', cookieValue);
}

// User login function (completely standalone)
async function loginUser(email, password, request = null) {
    try {
        // Get user with password hash
        const result = await pool.query(`
            SELECT id, email, password_hash, name, user_type, active, email_verified, profile_completed, avatar_url
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

export async function POST({ request }) {
    try {
        // Rate limiting
        const clientIP = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        '127.0.0.1';
        
        if (!checkRateLimit(`login_${clientIP}`, 10, 15 * 60 * 1000)) {
            return apiError('Too many login attempts. Please try again later.', 429);
        }
        
        // Parse request body
        const body = await request.json();
        const { email, password, remember = false } = body;
        
        // Validation
        if (!email || !password) {
            return apiError('Email and password are required');
        }
        
        if (!validateEmail(email)) {
            return apiError('Invalid email format');
        }
        
        // Login user
        const loginResult = await loginUser(email.toLowerCase().trim(), password, request);
        
        // Create response
        const response = apiResponse({
            success: true,
            message: 'Login successful',
            user: {
                id: loginResult.user.id,
                email: loginResult.user.email,
                name: loginResult.user.name,
                userType: loginResult.user.user_type,
                profileCompleted: loginResult.user.profile_completed,
                avatarUrl: loginResult.user.avatar_url
            },
            redirectUrl: loginResult.user.user_type === 'artist' ? '/dashboard/artist' : '/dashboard'
        });
        
        // Set authentication cookie
        const isSecure = request.url.startsWith('https://');
        setAuthCookie(response, loginResult.sessionToken, isSecure);
        
        return response;
        
    } catch (error) {
        console.error('Login error:', error);
        return apiError(error.message || 'Login failed', 401);
    }
} 