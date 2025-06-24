import type { APIRoute } from 'astro';
import { Pool } from 'pg';

// Database connection
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
  'postgresql://ishanpathak@localhost:5432/artist_events';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Helper function to parse cookies
function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  
  return null;
}

// Helper function to validate session and get user
async function validateSession(sessionToken: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT u.id, u.name, u.user_type 
      FROM users u 
      JOIN user_sessions s ON u.id = s.user_id 
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `, [sessionToken]);
    
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

interface BlogData {
  title: string;
  author: string;
  authorBio: string;
  publishedDate: string;
  readTime: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  featured?: boolean;
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const client = await pool.connect();
  
  try {
    // Check authentication
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response('Authentication required', { status: 401 });
    }

    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response('Authentication required', { status: 401 });
    }

    const user = await validateSession(sessionToken);
    if (!user) {
      return new Response('Invalid session', { status: 401 });
    }

    const blogData: BlogData = await request.json();
    
    // Validate required fields
    if (!blogData.title || !blogData.content || !blogData.excerpt || !blogData.category) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Generate slug from title
    const baseSlug = blogData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') // Remove leading/trailing dashes
      .trim() || 'blog-post'; // Fallback if slug is empty

    await client.query('BEGIN');

    // Check if slug exists and make it unique
    let finalSlug = baseSlug;
    let counter = 1;
    while (true) {
      const existingPost = await client.query(
        'SELECT id FROM blog_posts WHERE slug = $1',
        [finalSlug]
      );
      
      if (existingPost.rows.length === 0) {
        break; // Slug is unique
      }
      
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create blog post
    const result = await client.query(`
      INSERT INTO blog_posts (
        author_id, title, slug, content, excerpt, 
        featured, status, tags, 
        created_at, updated_at, published_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING id, slug
    `, [
      user.id, // author_id
      blogData.title,
      finalSlug,
      blogData.content,
      blogData.excerpt,
      blogData.featured || false,
      'published', // status - new blog posts are published
      blogData.tags || [] // PostgreSQL array
    ]);

    await client.query('COMMIT');

    const blogPost = result.rows[0];

    return new Response(JSON.stringify({ 
      success: true, 
      slug: blogPost.slug,
      id: blogPost.id,
      message: 'Blog post saved successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving blog post:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 });
  } finally {
    client.release();
  }
};