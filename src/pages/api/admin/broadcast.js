import { Pool } from 'pg';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Helper function to parse cookies
function parseCookie(cookieString, name) {
  const cookies = cookieString.split(';').map(cookie => cookie.trim());
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=');
    if (cookieName === name) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
}

export async function POST({ request }) {
  try {
    // Debug environment variables
    console.log('🔍 Environment Debug:');
    console.log(`RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'Found' : 'NOT FOUND'}`);
    console.log(`FROM_EMAIL: ${process.env.FROM_EMAIL || 'NOT SET'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

    // Verify admin authentication
    const cookies = request.headers.get('cookie');
    if (!cookies) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionToken = parseCookie(cookies, 'session_token');
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const client = await pool.connect();
    try {
      const sessionResult = await client.query(
        'SELECT u.* FROM users u JOIN user_sessions s ON u.id = s.user_id WHERE s.session_token = $1 AND s.expires_at > NOW()',
        [sessionToken]
      );

      if (sessionResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid session' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const currentUser = sessionResult.rows[0];
      const isAdmin = currentUser.user_type === 'admin' || currentUser.role === 'admin';

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const userId = currentUser.id;

      // Parse request data
      const data = await request.json();
      const { 
        broadcast_type, 
        subject, 
        content, 
        recipients, 
        cta_text, 
        cta_url,
        single_user_email
      } = data;

      // Validate required fields
      if (!broadcast_type || !subject || !content || !recipients) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: broadcast_type, subject, content, recipients' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Additional validation for single user email
      if (recipients === 'single' && !single_user_email) {
        return new Response(JSON.stringify({ 
          error: 'Email address is required when sending to a single user' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get recipient emails based on selection
      let recipientQuery;
      let queryParams = [];

      switch (recipients) {
        case 'test_mode':
          recipientQuery = `
            SELECT email, 
                   COALESCE(first_name || ' ' || last_name, first_name, email) as display_name, 
                   id 
            FROM users
            WHERE role = 'admin' OR email = 'ishan.pathak2711@gmail.com'
          `;
          break;
          
        case 'subscribers':
          recipientQuery = `
            SELECT DISTINCT u.email, 
                   COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email) as display_name, 
                   u.id
            FROM users u
            JOIN email_subscriptions es ON u.id = es.user_id
            WHERE es.is_subscribed = true
          `;
          break;
          
        case 'all':
          recipientQuery = `
            SELECT email, 
                   COALESCE(first_name || ' ' || last_name, first_name, email) as display_name, 
                   id 
            FROM users
          `;
          break;
          
        case 'artists':
          recipientQuery = `
            SELECT DISTINCT u.email, 
                   COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email) as display_name, 
                   u.id
            FROM users u
            WHERE u.role = 'artist' OR u.id IN (
              SELECT DISTINCT created_by FROM events WHERE created_by IS NOT NULL
            )
          `;
          break;
          
        case 'active':
          recipientQuery = `
            SELECT DISTINCT u.email, 
                   COALESCE(u.first_name || ' ' || u.last_name, u.first_name, u.email) as display_name, 
                   u.id
            FROM users u
            WHERE u.created_at >= NOW() - INTERVAL '30 days'
          `;
          break;
          
        case 'single':
          recipientQuery = `
            SELECT email, 
                   COALESCE(first_name || ' ' || last_name, first_name, email) as display_name, 
                   id 
            FROM users 
            WHERE email = $1
          `;
          queryParams = [single_user_email];
          break;
          
        default:
          return new Response(JSON.stringify({ 
            error: 'Invalid recipient type' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }

      const recipientResult = await client.query(recipientQuery, queryParams);
      const recipientEmails = recipientResult.rows;

      console.log(`🔍 DEBUG: Query executed for recipient type: ${recipients}`);
      console.log(`🔍 DEBUG: Found ${recipientEmails.length} recipients:`, recipientEmails);

      if (recipientEmails.length === 0) {
        const errorMessage = recipients === 'single' 
          ? `User with email '${single_user_email}' not found in the database`
          : 'No recipients found for selected criteria';
          
        return new Response(JSON.stringify({ 
          error: errorMessage
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create admin broadcast record
      const broadcastResult = await client.query(`
        INSERT INTO admin_broadcasts (
          admin_id, broadcast_type, subject, content, 
          cta_text, cta_url, recipient_type, recipient_count, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sending')
        RETURNING id
      `, [
        userId, broadcast_type, subject, content,
        cta_text || null, cta_url || null, recipients, recipientEmails.length
      ]);

      const broadcastId = broadcastResult.rows[0].id;

      // Create email template
      const emailTemplate = createBroadcastTemplate(
        broadcast_type, subject, content, cta_text, cta_url
      );

      // Send emails with rate limiting (Resend allows 2 req/sec)
      let sentCount = 0;
      let failedCount = 0;

      console.log(`🔍 DEBUG: Starting to send emails to ${recipientEmails.length} recipients`);

      // Send emails one by one with delays to respect rate limits
      for (let i = 0; i < recipientEmails.length; i++) {
        const recipient = recipientEmails[i];
        console.log(`🔍 DEBUG: Processing recipient ${i + 1}/${recipientEmails.length}: ${recipient.email}`);
        
        try {
          console.log(`🔍 DEBUG: Starting email for recipient:`, recipient);
          
          const personalizedContent = emailTemplate
            .replace(/\{\{username\}\}/g, recipient.display_name || 'Member')
            .replace(/\{\{email\}\}/g, recipient.email)
            .replace(/\{\{broadcastId\}\}/g, broadcastId)
            .replace(/\{\{userId\}\}/g, recipient.id);

          const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
          console.log(`🚀 Attempting to send email to: ${recipient.email}`);
          console.log(`📧 From: ${fromEmail}`);
          console.log(`📝 Subject: ${subject}`);
          console.log(`🔑 Using Resend API Key: ${process.env.RESEND_API_KEY ? 'Found' : 'NOT FOUND'}`);

          const result = await resend.emails.send({
            from: `Artist Events Team <${fromEmail}>`,
            to: recipient.email,
            subject: subject,
            html: personalizedContent,
            tags: [
              { name: 'broadcastId', value: broadcastId.toString() },
              { name: 'userId', value: recipient.id.toString() },
              { name: 'type', value: 'admin_broadcast' }
            ]
          });

          if (result.error) {
            console.log(`⚠️ Email API error for ${recipient.email}:`, result.error);
            failedCount++;
          } else {
            console.log(`✅ Email sent successfully to ${recipient.email}:`, result);
            sentCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to send email to ${recipient.email}:`, error);
          console.error(`❌ Error details:`, error.message);
          failedCount++;
        }
        
        // Add delay between emails to respect rate limits (Resend allows 2 req/sec)
        if (i < recipientEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 600)); // 0.6 second delay = ~1.7 req/sec
        }
      }

      // Update broadcast status
      const finalStatus = failedCount === 0 ? 'sent' : 
                         sentCount === 0 ? 'failed' : 'partial';

      await client.query(`
        UPDATE admin_broadcasts 
        SET status = $1, sent_count = $2, failed_count = $3, sent_at = NOW()
        WHERE id = $4
      `, [finalStatus, sentCount, failedCount, broadcastId]);

      const successMessage = recipients === 'single' 
        ? `Email sent successfully to ${single_user_email}`
        : `Broadcast sent successfully to ${sentCount} recipients`;

      return new Response(JSON.stringify({
        success: true,
        message: successMessage,
        stats: {
          total: recipientEmails.length,
          sent: sentCount,
          failed: failedCount,
          broadcastId: broadcastId,
          recipientType: recipients,
          ...(recipients === 'single' && { singleRecipient: single_user_email })
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Admin broadcast error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to send broadcast: ' + error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function createBroadcastTemplate(type, subject, content, ctaText, ctaUrl) {
  const siteUrl = process.env.SITE_URL || 'https://artist-events-theta.vercel.app';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${subject}</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f8fafc;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; padding: 20px 0;">
        <tr>
          <td align="center">
            <!-- Main Container -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px 40px; text-align: center; background-color: #1f2937; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; line-height: 1.3;">
                    Artist Events
                  </h1>
                  <p style="margin: 8px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #9ca3af;">
                    Connecting artists and music lovers
                  </p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  <!-- Subject Line -->
                  <h2 style="margin: 0 0 24px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 600; color: #1f2937; line-height: 1.3;">
                    ${subject}
                  </h2>
                  
                  <!-- Greeting -->
                  <p style="margin: 0 0 20px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #374151; line-height: 1.6;">
                    Hello {{username}},
                  </p>
                  
                  <!-- Main Content -->
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #374151; line-height: 1.6;">
                    ${content.split('\n').map(paragraph => 
                      paragraph.trim() ? `<p style="margin: 0 0 16px 0;">${paragraph.trim()}</p>` : ''
                    ).join('')}
                  </div>
                </td>
              </tr>
              
              ${ctaText && ctaUrl ? `
              <!-- Call to Action -->
              <tr>
                <td style="padding: 0 40px 30px 40px; text-align: center;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                    <tr>
                      <td style="background-color: #3b82f6; border-radius: 6px; text-align: center;">
                        <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                          ${ctaText}
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              ` : ''}
              
              <!-- Quick Links -->
              <tr>
                <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #6b7280;">
                          Quick Links
                        </p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                          <tr>
                            <td style="padding: 0 12px;">
                              <a href="${siteUrl}/events" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #3b82f6; text-decoration: none; font-weight: 500;">
                                Browse Events
                              </a>
                            </td>
                            <td style="padding: 0 12px; color: #d1d5db;">|</td>
                            <td style="padding: 0 12px;">
                              <a href="${siteUrl}/submit" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #3b82f6; text-decoration: none; font-weight: 500;">
                                Submit Event
                              </a>
                            </td>
                            <td style="padding: 0 12px; color: #d1d5db;">|</td>
                            <td style="padding: 0 12px;">
                              <a href="${siteUrl}/dashboard" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #3b82f6; text-decoration: none; font-weight: 500;">
                                Dashboard
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="text-align: center;">
                        <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #6b7280; line-height: 1.5;">
                          You're receiving this email as a member of Artist Events.
                        </p>
                        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #9ca3af;">
                          <a href="${siteUrl}/dashboard" style="color: #6b7280; text-decoration: none;">Manage preferences</a>
                          <span style="margin: 0 8px; color: #d1d5db;">•</span>
                          <a href="${siteUrl}/api/email/unsubscribe?email={{email}}" style="color: #6b7280; text-decoration: none;">Unsubscribe</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
      
      <!-- Tracking Pixel -->
      <img src="${siteUrl}/api/email/track-open?bid={{broadcastId}}&uid={{userId}}" 
           width="1" height="1" style="display: block; width: 1px; height: 1px; opacity: 0;" alt="" />
    </body>
    </html>
  `;
} 