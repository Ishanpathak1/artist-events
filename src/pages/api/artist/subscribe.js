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
    const { artistId, action } = body;

    // Validate input
    if (!artistId || typeof artistId !== 'number') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid artist ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!action || !['subscribe', 'unsubscribe'].includes(action)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid action is required (subscribe or unsubscribe)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const is_subscribed = action === 'subscribe';

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if artist exists
      const artistCheck = await client.query(
        'SELECT id, name FROM users WHERE id = $1',
        [artistId]
      );

      if (artistCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({
          success: false,
          error: 'Artist not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Can't subscribe to yourself
      if (artistId === authResult.user.id) {
        await client.query('ROLLBACK');
        return new Response(JSON.stringify({
          success: false,
          error: 'Cannot subscribe to yourself'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if subscription record exists
      const existingSubscription = await client.query(`
        SELECT id, is_subscribed 
        FROM artist_subscriptions 
        WHERE user_id = $1 AND artist_id = $2
      `, [authResult.user.id, artistId]);

      let result;

      if (existingSubscription.rows.length > 0) {
        // Update existing subscription
        result = await client.query(`
          UPDATE artist_subscriptions 
          SET is_subscribed = $1, subscribed_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE subscribed_at END, unsubscribed_at = CASE WHEN NOT $1 THEN CURRENT_TIMESTAMP ELSE NULL END
          WHERE user_id = $2 AND artist_id = $3
          RETURNING id
        `, [is_subscribed, authResult.user.id, artistId]);
      } else {
        // Create new subscription
        result = await client.query(`
          INSERT INTO artist_subscriptions (user_id, artist_id, is_subscribed, subscribed_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          RETURNING id
        `, [authResult.user.id, artistId, is_subscribed]);
      }

      // Get updated subscriber count
      const countResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM artist_subscriptions 
        WHERE artist_id = $1 AND is_subscribed = true
      `, [artistId]);

      const subscriberCount = parseInt(countResult.rows[0].count);

      await client.query('COMMIT');

      // Log the action for analytics
  

      return new Response(JSON.stringify({
        success: true,
        message: is_subscribed ? 'Successfully subscribed' : 'Successfully unsubscribed',
        subscription_id: result.rows[0].id,
        subscriberCount: subscriberCount,
        isSubscribed: is_subscribed
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Subscription error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update subscription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 