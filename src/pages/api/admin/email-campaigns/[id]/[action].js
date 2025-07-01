import { Pool } from 'pg';
import { authenticateUser } from '../../../../../../lib/auth-middleware.js';
import { EmailService } from '../../../../../lib/email-service.js';

// Database connection
const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || 
  'postgresql://ishanpathak@localhost:5432/artist_events';

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST({ params, request }) {
  try {
    const { id, action } = params;
    
    // Authenticate admin
    const authResult = await authenticateUser(request);
    if (!authResult.user || (authResult.user.user_type !== 'admin' && authResult.user.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const admin = authResult.user;
    const client = await pool.connect();

    try {
      // Get campaign details
      const campaignResult = await client.query(
        'SELECT * FROM email_campaigns WHERE id = $1',
        [id]
      );

      if (campaignResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Campaign not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const campaign = campaignResult.rows[0];

      switch (action) {
        case 'approve':
          return await approveCampaign(client, id, admin.id);
        
        case 'reject':
          const body = await request.json();
          return await rejectCampaign(client, id, admin.id, body.notes);
        
        case 'send':
          return await sendCampaign(client, campaign, admin.id);
        
        default:
          return new Response(JSON.stringify({ error: 'Invalid action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Email campaign action error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET({ params, request }) {
  try {
    const { id, action } = params;
    
    // Authenticate admin
    const authResult = await authenticateUser(request);
    if (!authResult.user || (authResult.user.user_type !== 'admin' && authResult.user.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'preview') {
      return await previewCampaign(id);
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email campaign GET error:', error);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function approveCampaign(client, campaignId, adminId) {
  // Check if campaign is pending
  const campaign = await client.query(
    'SELECT status FROM email_campaigns WHERE id = $1',
    [campaignId]
  );

  if (campaign.rows[0].status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Campaign is not pending review' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Approve campaign
  await client.query(`
    UPDATE email_campaigns 
    SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
    WHERE id = $2
  `, [adminId, campaignId]);

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Campaign approved successfully' 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function rejectCampaign(client, campaignId, adminId, notes) {
  if (!notes || notes.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Rejection reason is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check if campaign is pending
  const campaign = await client.query(
    'SELECT status FROM email_campaigns WHERE id = $1',
    [campaignId]
  );

  if (campaign.rows[0].status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Campaign is not pending review' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Reject campaign
  await client.query(`
    UPDATE email_campaigns 
    SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
    WHERE id = $3
  `, [adminId, notes.trim(), campaignId]);

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Campaign rejected successfully' 
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function sendCampaign(client, campaign, adminId) {
  // Check if campaign is approved
  if (campaign.status !== 'approved') {
    return new Response(JSON.stringify({ error: 'Campaign must be approved before sending' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Use EmailService to send the campaign
    const emailService = new EmailService();
    const result = await emailService.sendCampaign(campaign.id);

    if (result.success) {
      // Update campaign status
      await client.query(`
        UPDATE email_campaigns 
        SET status = 'sent', sent_at = NOW(), emails_sent = $1
        WHERE id = $2
      `, [result.totalSent, campaign.id]);

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Campaign sent successfully',
        totalRecipients: result.totalRecipients,
        emailsSent: result.totalSent
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error(result.error || 'Failed to send campaign');
    }

  } catch (error) {
    console.error('Error sending campaign:', error);
    
    // Update campaign with error status
    await client.query(`
      UPDATE email_campaigns 
      SET admin_notes = $1
      WHERE id = $2
    `, [`Send error: ${error.message}`, campaign.id]);

    return new Response(JSON.stringify({ 
      error: 'Failed to send campaign: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function previewCampaign(campaignId) {
  const client = await pool.connect();
  
  try {
    // Get campaign with template
    const result = await client.query(`
      SELECT 
        ec.*,
        et.html_content,
        u.name as artist_name
      FROM email_campaigns ec
      JOIN email_templates et ON ec.template_id = et.id
      JOIN users u ON ec.artist_id = u.id
      WHERE ec.id = $1
    `, [campaignId]);

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const campaign = result.rows[0];
    
    // Process template with campaign data
    let preview = campaign.html_content;
    
    // Replace template variables
    const variables = campaign.raw_content || {};
    preview = preview.replace(/\{\{artist_name\}\}/g, campaign.artist_name || 'Artist Name');
    preview = preview.replace(/\{\{subject\}\}/g, campaign.subject || 'Email Subject');
    
    // Replace other variables from raw_content
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, variables[key] || `{{${key}}}`);
    });

    // Add unsubscribe link placeholder
    preview = preview.replace(/\{\{unsubscribe_url\}\}/g, '#unsubscribe-link');

    return new Response(JSON.stringify({ 
      success: true, 
      preview: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: #f1f5f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <strong>Subject:</strong> ${campaign.subject}
          </div>
          ${preview}
        </div>
      `
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } finally {
    client.release();
  }
} 