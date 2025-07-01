import { Pool } from 'pg';
import { authenticateUser } from '../../../../lib/auth-middleware.js';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST({ request }) {
  try {
    // Authenticate admin
    const authResult = await authenticateUser(request);
    if (!authResult.user || authResult.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = authResult.user;
    const data = await request.json();
    const { campaign_id, action, notes } = data;

    if (!campaign_id || !action) {
      return new Response(JSON.stringify({ 
        error: 'Campaign ID and action are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!['approve', 'reject', 'request_changes'].includes(action)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid action. Must be: approve, reject, or request_changes' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const client = await pool.connect();
    
    try {
      // Get campaign details
      const campaignResult = await client.query(`
        SELECT c.*, u.email as artist_email, 
               COALESCE(u.first_name || ' ' || u.last_name, u.email) as artist_name
        FROM artist_email_campaigns c
        JOIN users u ON c.artist_id = u.id
        WHERE c.id = $1
      `, [campaign_id]);

      if (campaignResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const campaign = campaignResult.rows[0];

      if (campaign.status !== 'pending') {
        return new Response(JSON.stringify({ 
          error: 'Only pending campaigns can be reviewed' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let newStatus;
      let actionDescription;

      switch (action) {
        case 'approve':
          newStatus = 'approved';
          actionDescription = 'Campaign approved and ready to send';
          break;
        case 'reject':
          newStatus = 'rejected';
          actionDescription = 'Campaign rejected';
          break;
        case 'request_changes':
          newStatus = 'draft'; // Send back to draft for editing
          actionDescription = 'Changes requested - returned to draft';
          break;
      }

      // Update campaign status
      await client.query(`
        UPDATE artist_email_campaigns 
        SET status = $1, reviewed_by = $2, reviewed_at = NOW(), 
            admin_notes = $3, rejection_reason = $4
        WHERE id = $5
      `, [
        newStatus, admin.id, notes || null, 
        action === 'reject' ? notes : null, campaign_id
      ]);

      // Add to approval history
      await client.query(`
        INSERT INTO campaign_approval_history (campaign_id, admin_id, action, notes)
        VALUES ($1, $2, $3, $4)
      `, [campaign_id, admin.id, action, notes || actionDescription]);

      // TODO: Send notification email to artist about the decision
      // This could be added later to notify artists of approval/rejection

      return new Response(JSON.stringify({
        success: true,
        message: actionDescription,
        campaign_id: campaign_id,
        new_status: newStatus,
        action: action
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Review campaign error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to review campaign: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET endpoint to fetch pending campaigns for review
export async function GET({ request }) {
  try {
    // Authenticate admin
    const authResult = await authenticateUser(request);
    if (!authResult.user || authResult.user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';

    const client = await pool.connect();
    
    try {
      const campaignsResult = await client.query(`
        SELECT 
          c.*,
          COALESCE(u.first_name || ' ' || u.last_name, u.email) as artist_name,
          u.email as artist_email,
          CASE 
            WHEN c.audience_type = 'my_fans' THEN CONCAT('👥 My Fans (', c.estimated_recipients, ')')
            WHEN c.audience_type = 'everyone' THEN CONCAT('🌍 Everyone (', c.estimated_recipients, ')')
            WHEN c.audience_type = 'event_attendees' THEN '🎪 Event Attendees'
            ELSE c.audience_type
          END as audience_display
        FROM artist_email_campaigns c
        JOIN users u ON c.artist_id = u.id
        WHERE c.status = $1
        ORDER BY c.submitted_at DESC
      `, [status]);

      return new Response(JSON.stringify({
        success: true,
        campaigns: campaignsResult.rows
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Get campaigns error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch campaigns: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 