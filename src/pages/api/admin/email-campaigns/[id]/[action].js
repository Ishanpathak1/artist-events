import { Pool } from 'pg';
import { Resend } from 'resend';

// Use inline authentication instead of importing the problematic module
async function authenticateUser(request) {
  try {
    const cookies = request.headers.get('cookie');
    if (!cookies) return { user: null, authenticated: false };
    
    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) return { user: null, authenticated: false };
    
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, u.user_type, u.active, u.role
      FROM users u
      JOIN user_sessions s ON u.id = s.user_id
      WHERE s.session_token = $1 AND s.expires_at > CURRENT_TIMESTAMP
    `, [sessionToken]);
    
    return result.rows.length > 0 
      ? { user: result.rows[0], authenticated: true }
      : { user: null, authenticated: false };
  } catch (error) {
    console.error('Auth error:', error);
    return { user: null, authenticated: false };
  }
}

function parseCookie(cookieString, name) {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) return decodeURIComponent(cookieValue);
  }
  return null;
}

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
    if (!authResult.user || authResult.user.user_type !== 'admin') {
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
    if (!authResult.user || authResult.user.user_type !== 'admin') {
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
    // Initialize Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Get campaign recipients (simplified version)
    const recipientsResult = await client.query(`
      SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
      FROM users u
      JOIN email_subscriptions es ON u.id = es.user_id
      WHERE es.is_subscribed = true 
        AND u.email IS NOT NULL 
        AND u.email != ''
    `);
    
    const recipients = recipientsResult.rows;
    
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'No recipients found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Send emails in batches
    let emailsSent = 0;
    const batchSize = 10;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const emailPromises = batch.map(async (recipient) => {
        try {
          await resend.emails.send({
            from: `Artist Events <${process.env.FROM_EMAIL || 'onboarding@resend.dev'}>`,
            to: recipient.email,
            subject: campaign.subject,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${campaign.subject}</h2>
                <p>Hi ${recipient.first_name || 'there'},</p>
                <div>${campaign.content?.replace(/\n/g, '<br>') || ''}</div>
                <hr>
                <p style="font-size: 12px; color: #666;">
                  <a href="${process.env.SITE_URL || 'https://artist-events-theta.vercel.app'}/api/email/unsubscribe?email=${recipient.email}">Unsubscribe</a>
                </p>
              </div>
            `,
            tags: [
              { name: 'campaignId', value: campaign.id.toString() },
              { name: 'userId', value: recipient.id.toString() }
            ]
          });
          emailsSent++;
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
        }
      });
      
      await Promise.all(emailPromises);
    }

    // Update campaign status
    await client.query(`
      UPDATE email_campaigns 
      SET status = 'sent', sent_at = NOW(), emails_sent = $1
      WHERE id = $2
    `, [emailsSent, campaign.id]);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Campaign sent successfully',
      totalRecipients: recipients.length,
      emailsSent: emailsSent
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

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