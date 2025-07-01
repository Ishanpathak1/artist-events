import { Pool } from 'pg';

// Database configuration
const DB_CONFIG = (() => {
  if (process.env.NEON_DATABASE_URL) {
    return {
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    };
  }
  
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }
  
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

export async function GET(context) {
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');
  const userId = url.searchParams.get('user_id');
  const campaignId = url.searchParams.get('campaign_id');
  const broadcastId = url.searchParams.get('broadcast_id');
  
  // Redirect to the new unsubscribe page with parameters
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (userId) params.set('user_id', userId);
  if (campaignId) params.set('campaign_id', campaignId);
  if (broadcastId) params.set('broadcast_id', broadcastId);
  
  const redirectUrl = `/unsubscribe${params.toString() ? '?' + params.toString() : ''}`;
  return Response.redirect(new URL(redirectUrl, context.url), 302);
}

export async function POST({ request }) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const client = await pool.connect();
    try {
      // Find the user by email
      const userResult = await client.query(
        'SELECT id, name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (userResult.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Email address not found in our system' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      const user = userResult.rows[0];
      
      // Check if already unsubscribed
      const subResult = await client.query(
        'SELECT is_subscribed FROM email_subscriptions WHERE user_id = $1',
        [user.id]
      );
      
      if (subResult.rows.length > 0 && !subResult.rows[0].is_subscribed) {
        return new Response(
          JSON.stringify({ error: 'You are already unsubscribed from our emails' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Unsubscribe the user
      await client.query(`
        UPDATE email_subscriptions 
        SET is_subscribed = false, unsubscribed_at = NOW()
        WHERE user_id = $1
      `, [user.id]);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Successfully unsubscribed from email notifications',
          user: { name: user.name, email: email }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process unsubscribe request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
} 