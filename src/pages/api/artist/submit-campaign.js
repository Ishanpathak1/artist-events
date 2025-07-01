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
    const { campaign_id } = data;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Verify campaign belongs to user and is in draft status
      const campaignResult = await client.query(`
        SELECT id, artist_id, status, audience_type, subject
        FROM artist_email_campaigns 
        WHERE id = $1 AND artist_id = $2
      `, [campaign_id, user.id]);

      if (campaignResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const campaign = campaignResult.rows[0];

      if (campaign.status !== 'draft') {
        return new Response(JSON.stringify({ 
          error: 'Only draft campaigns can be submitted for review' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update campaign status to pending
      await client.query(`
        UPDATE artist_email_campaigns 
        SET status = 'pending', submitted_at = NOW()
        WHERE id = $1
      `, [campaign_id]);

      // Add to approval history
      await client.query(`
        INSERT INTO campaign_approval_history (campaign_id, admin_id, action, notes)
        VALUES ($1, $2, 'submitted', 'Campaign submitted for admin review')
      `, [campaign_id, user.id]);

      // Determine if auto-approval is possible (for "my_fans" campaigns)
      let requiresApproval = true;
      let statusMessage = 'Campaign submitted for admin review';

      if (campaign.audience_type === 'my_fans') {
        // For fan-only campaigns, we could auto-approve
        // But let's keep admin review for now
        statusMessage = 'Campaign submitted for review (fan audience)';
      } else if (campaign.audience_type === 'everyone') {
        statusMessage = 'Campaign submitted for review (platform-wide requires approval)';
      }

      return new Response(JSON.stringify({
        success: true,
        message: statusMessage,
        status: 'pending',
        requires_approval: requiresApproval
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Submit campaign error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to submit campaign: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 