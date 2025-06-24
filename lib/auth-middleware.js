// Authentication middleware for Astro
export async function authenticateUser(request) {
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
        
        // We'll import validateSession dynamically to avoid circular dependency
        const { validateSession } = await import('./auth.js');
        
        // Validate session
        const user = await validateSession(sessionToken);
        
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

// Role-based access control
export function requireAuth(user, allowedRoles = null) {
    if (!user) {
        throw new Error('Authentication required');
    }
    
    if (allowedRoles && !allowedRoles.includes(user.user_type)) {
        throw new Error('Insufficient permissions');
    }
    
    return true;
}

// Check if user can edit content
export function canEditContent(user, contentCreatorId) {
    if (!user) return false;
    
    // Admin can edit anything
    if (user.user_type === 'admin') return true;
    
    // Users can edit their own content
    return user.id === contentCreatorId;
}

// Create secure cookie options
export function getCookieOptions(secure = false) {
    return {
        httpOnly: true,
        secure: secure, // true for HTTPS in production
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 // 7 days
    };
}

// Set authentication cookie
export function setAuthCookie(response, sessionToken, secure = false) {
    const options = getCookieOptions(secure);
    const cookieValue = `session_token=${encodeURIComponent(sessionToken)}; ` +
        `Max-Age=${options.maxAge}; ` +
        `Path=${options.path}; ` +
        `SameSite=${options.sameSite}; ` +
        (options.httpOnly ? 'HttpOnly; ' : '') +
        (options.secure ? 'Secure; ' : '');
    
    response.headers.set('Set-Cookie', cookieValue);
}

// Clear authentication cookie
export function clearAuthCookie(response, secure = false) {
    const cookieValue = `session_token=; ` +
        `Max-Age=0; ` +
        `Path=/; ` +
        `SameSite=lax; ` +
        `HttpOnly; ` +
        (secure ? 'Secure; ' : '');
    
    response.headers.set('Set-Cookie', cookieValue);
}

// Redirect helpers
export function redirectToLogin(redirectUrl = '/') {
    const loginUrl = `/auth/login?redirect=${encodeURIComponent(redirectUrl)}`;
    return new Response(null, {
        status: 302,
        headers: { Location: loginUrl }
    });
}

export function redirectToDashboard(userType) {
    const dashboardUrl = userType === 'artist' ? '/dashboard/artist' : '/dashboard';
    return new Response(null, {
        status: 302,
        headers: { Location: dashboardUrl }
    });
}

// API response helpers
export function apiResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

export function apiError(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

// Validation helpers
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitStore = new Map();

export function checkRateLimit(identifier, limit = 5, windowMs = 15 * 60 * 1000) {
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