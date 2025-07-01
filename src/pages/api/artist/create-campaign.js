import { Pool } from 'pg';
import { authenticateUser } from '../../../../lib/auth-middleware.js';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST({ request }) {
  try {
    // Authenticate user
    const authResult = await authenticateUser(request);
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = authResult.user;
    const data = await request.json();
    
    const { 
      subject, 
      content, 
      campaign_type = 'general',
      audience_type,
      audience_filter = {},
      scheduled_at,
      send_immediately = false
    } = data;

    // Validate required fields
    if (!subject || !content || !audience_type) {
      return new Response(JSON.stringify({ 
        error: 'Subject, content, and audience type are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Estimate recipient count based on audience type
      let estimatedRecipients = 0;
      
      switch (audience_type) {
        case 'my_fans':
          const fanResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM artist_subscriptions 
            WHERE artist_id = $1 AND is_subscribed = true
          `, [user.id]);
          estimatedRecipients = fanResult.rows[0].count;
          break;
          
        case 'everyone':
          const allResult = await client.query(`
            SELECT COUNT(*) as count 
            FROM users
          `);
          estimatedRecipients = allResult.rows[0].count;
          break;
          
        case 'event_attendees':
          if (audience_filter.event_id) {
            // Count event attendees (if you have attendance tracking)
            estimatedRecipients = 0; // Implement based on your event attendance system
          }
          break;
      }

      // Create campaign
      const campaignResult = await client.query(`
        INSERT INTO artist_email_campaigns (
          artist_id, subject, content, campaign_type, 
          audience_type, audience_filter, estimated_recipients,
          scheduled_at, send_immediately, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        user.id, subject, content, campaign_type,
        audience_type, JSON.stringify(audience_filter), estimatedRecipients,
        scheduled_at || null, send_immediately,
        audience_type === 'everyone' ? 'draft' : 'draft' // Platform-wide needs admin approval
      ]);

      const campaignId = campaignResult.rows[0].id;

      return new Response(JSON.stringify({
        success: true,
        campaign_id: campaignId,
        estimated_recipients: estimatedRecipients,
        message: 'Campaign created successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Create campaign error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to create campaign: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 