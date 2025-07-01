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
    const { artist_id, is_subscribed } = body;

    // Validate input
    if (!artist_id || typeof artist_id !== 'number') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid artist ID is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (typeof is_subscribed !== 'boolean') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Subscription status must be boolean'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if artist exists
      const artistCheck = await client.query(
        'SELECT id, name FROM users WHERE id = $1',
        [artist_id]
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
      if (artist_id === authResult.user.id) {
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
      `, [authResult.user.id, artist_id]);

      let result;

      if (existingSubscription.rows.length > 0) {
        // Update existing subscription
        result = await client.query(`
          UPDATE artist_subscriptions 
          SET is_subscribed = $1, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $2 AND artist_id = $3
          RETURNING id
        `, [is_subscribed, authResult.user.id, artist_id]);
      } else {
        // Create new subscription
        result = await client.query(`
          INSERT INTO artist_subscriptions (user_id, artist_id, is_subscribed, created_at, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `, [authResult.user.id, artist_id, is_subscribed]);
      }

      // Get updated subscriber count
      const countResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM artist_subscriptions 
        WHERE artist_id = $1 AND is_subscribed = true
      `, [artist_id]);

      const subscriberCount = parseInt(countResult.rows[0].count);

      await client.query('COMMIT');

      // Log the action for analytics
  

      return new Response(JSON.stringify({
        success: true,
        message: is_subscribed ? 'Successfully subscribed' : 'Successfully unsubscribed',
        subscription_id: result.rows[0].id,
        subscriber_count: subscriberCount,
        is_subscribed: is_subscribed
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