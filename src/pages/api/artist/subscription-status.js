import { Pool } from 'pg';
import { authenticateUser } from '../../../../lib/auth-middleware.js';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST({ request }) {
  try {
    // Check authentication
    const authResult = await authenticateUser(request);
    if (!authResult.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { artist_ids } = body;

    // Validate input
    if (!Array.isArray(artist_ids) || artist_ids.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Artist IDs array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that all items are numbers
    if (!artist_ids.every(id => typeof id === 'number' && id > 0)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'All artist IDs must be positive numbers'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Get subscription status for all artists
      const subscriptionQuery = `
        WITH artist_counts AS (
          SELECT 
            artist_id,
            COUNT(*) FILTER (WHERE is_subscribed = true) as subscriber_count
          FROM artist_subscriptions 
          WHERE artist_id = ANY($1)
          GROUP BY artist_id
        ),
        user_subscriptions AS (
          SELECT 
            artist_id,
            is_subscribed
          FROM artist_subscriptions
          WHERE user_id = $2 AND artist_id = ANY($1)
        )
        SELECT 
          unnest($1::int[]) as artist_id,
          COALESCE(us.is_subscribed, false) as is_subscribed,
          COALESCE(ac.subscriber_count, 0) as subscriber_count
        FROM (SELECT 1) dummy
        LEFT JOIN user_subscriptions us ON us.artist_id = unnest($1::int[])
        LEFT JOIN artist_counts ac ON ac.artist_id = unnest($1::int[])
      `;

      const result = await client.query(subscriptionQuery, [artist_ids, authResult.user.id]);

      // Create a map for easy lookup
      const subscriptionMap = new Map();
      result.rows.forEach(row => {
        subscriptionMap.set(row.artist_id, {
          artist_id: row.artist_id,
          is_subscribed: row.is_subscribed,
          subscriber_count: parseInt(row.subscriber_count)
        });
      });

      // Ensure we have data for all requested artists
      const subscriptions = artist_ids.map(artistId => {
        return subscriptionMap.get(artistId) || {
          artist_id: artistId,
          is_subscribed: false,
          subscriber_count: 0
        };
      });

      return new Response(JSON.stringify({
        success: true,
        subscriptions: subscriptions
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Subscription status error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch subscription status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET({ url }) {
  try {
    const request = new Request(url);
    const authResult = await authenticateUser(request);
    
    if (!authResult.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const artistId = url.searchParams.get('artist_id');
    
    if (!artistId || isNaN(parseInt(artistId))) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid artist ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Get subscription status for single artist
      const result = await client.query(`
        SELECT 
          COALESCE(
            (SELECT is_subscribed FROM artist_subscriptions 
             WHERE user_id = $1 AND artist_id = $2), 
            false
          ) as is_subscribed,
          (SELECT COUNT(*) FROM artist_subscriptions 
           WHERE artist_id = $2 AND is_subscribed = true) as subscriber_count
      `, [authResult.user.id, parseInt(artistId)]);

      const row = result.rows[0];

      return new Response(JSON.stringify({
        success: true,
        artist_id: parseInt(artistId),
        is_subscribed: row.is_subscribed,
        subscriber_count: parseInt(row.subscriber_count)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Subscription status error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch subscription status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 