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

function validatePassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
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
async function hashPassword(password) {
    return await bcrypt.hash(password, 12);
}

// User registration function (completely standalone)
async function registerUser(userData) {
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

export async function POST({ request }) {
    try {
        // Rate limiting
        const clientIP = request.headers.get('x-forwarded-for') || 
                        request.headers.get('x-real-ip') || 
                        '127.0.0.1';
        
        if (!checkRateLimit(`register_${clientIP}`, 5, 15 * 60 * 1000)) {
            return apiError('Too many registration attempts. Please try again later.', 429);
        }
        
        // Parse request body
        const body = await request.json();
        const { email, password, confirmPassword, name, userType = 'audience' } = body;
        
        // Validation
        if (!email || !password || !confirmPassword || !name) {
            return apiError('All fields are required');
        }
        
        if (!validateEmail(email)) {
            return apiError('Invalid email format');
        }
        
        if (!validatePassword(password)) {
            return apiError('Password must be at least 8 characters with uppercase, lowercase, and number');
        }
        
        if (password !== confirmPassword) {
            return apiError('Passwords do not match');
        }
        
        if (!['audience', 'artist'].includes(userType)) {
            return apiError('Invalid user type');
        }
        
        if (name.length < 2 || name.length > 100) {
            return apiError('Name must be between 2 and 100 characters');
        }
        
        // Register user
        const user = await registerUser({
            email: email.toLowerCase().trim(),
            password,
            name: name.trim(),
            userType
        });
        
        return apiResponse({
            success: true,
            message: 'Registration successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                userType: user.user_type,
                profileCompleted: user.profile_completed
            }
        }, 201);
        
    } catch (error) {
        console.error('Registration error:', error);
        return apiError(error.message || 'Registration failed', 400);
    }
} 