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
    const { artistIds } = body;

    // Validate input
    if (!Array.isArray(artistIds) || artistIds.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Artist IDs array is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate that all items are numbers
    if (!artistIds.every(id => typeof id === 'number' && id > 0)) {
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
      // Get user's subscription status for these artists
      const userSubscriptionsQuery = `
        SELECT artist_id, is_subscribed
        FROM artist_subscriptions
        WHERE user_id = $1 AND artist_id = ANY($2)
      `;
      const userSubscriptions = await client.query(userSubscriptionsQuery, [authResult.user.id, artistIds]);

      // Get subscriber counts for these artists
      const subscriberCountsQuery = `
        SELECT 
          artist_id,
          COUNT(*) FILTER (WHERE is_subscribed = true) as subscriber_count
        FROM artist_subscriptions 
        WHERE artist_id = ANY($1)
        GROUP BY artist_id
      `;
      const subscriberCounts = await client.query(subscriberCountsQuery, [artistIds]);

      // Create maps for easy lookup
      const userSubMap = new Map();
      userSubscriptions.rows.forEach(row => {
        userSubMap.set(row.artist_id, row.is_subscribed);
      });

      const countMap = new Map();
      subscriberCounts.rows.forEach(row => {
        countMap.set(row.artist_id, parseInt(row.subscriber_count));
      });

      // Build response for all requested artists
      const subscriptions = artistIds.map(artistId => ({
        artistId: artistId,
        isSubscribed: userSubMap.get(artistId) || false,
        subscriberCount: countMap.get(artistId) || 0
      }));

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
        artistId: parseInt(artistId),
        isSubscribed: row.is_subscribed,
        subscriberCount: parseInt(row.subscriber_count)
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