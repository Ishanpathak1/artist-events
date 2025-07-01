import { Resend } from 'resend';
import { Pool } from 'pg';

const resend = new Resend(process.env.RESEND_API_KEY);

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Email Service for Artist Events Platform
 * Handles template processing, sending, and analytics
 */
export class EmailService {
  
  /**
   * Process email template with variables
   */
  static processTemplate(htmlContent, variables = {}) {
    let processedContent = htmlContent;
    
    // Replace template variables {{variable_name}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedContent = processedContent.replace(regex, value || '');
    });
    
    // Add tracking pixel for open tracking
    const trackingPixel = `<img src="${process.env.SITE_URL || 'https://artist-events-theta.vercel.app'}/api/email/track-open?campaign_id={{campaign_id}}&user_id={{user_id}}" width="1" height="1" style="display:none;" alt="">`;
    processedContent = processedContent.replace('</body>', trackingPixel + '</body>');
    
    return processedContent;
  }

  /**
   * Get campaign recipients based on audience settings
   */
  static async getCampaignRecipients(campaignId) {
    const client = await pool.connect();
    
    try {
      // Get campaign details
      const campaignResult = await client.query(`
        SELECT target_audience, audience_filter, artist_id 
        FROM email_campaigns 
        WHERE id = $1
      `, [campaignId]);
      
      if (campaignResult.rows.length === 0) {
        throw new Error('Campaign not found');
      }
      
      const { target_audience, audience_filter, artist_id } = campaignResult.rows[0];
      
      let recipientsQuery;
      let queryParams = [];
      
      switch (target_audience) {
        case 'all':
          recipientsQuery = `
            SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
            FROM users u
            JOIN email_subscriptions es ON u.id = es.user_id
            WHERE es.is_subscribed = true 
              AND u.email IS NOT NULL 
              AND u.email != ''
          `;
          break;
          
        case 'event_attendees':
          // Users who have attended or RSVP'd to artist's events
          recipientsQuery = `
            SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
            FROM users u
            JOIN email_subscriptions es ON u.id = es.user_id
            JOIN events e ON e.user_id = $1  -- events by this artist
            WHERE es.is_subscribed = true 
              AND u.email IS NOT NULL 
              AND u.email != ''
          `;
          queryParams = [artist_id];
          break;
          
        case 'city_based':
          // Users in specific city (from audience_filter)
          const city = audience_filter?.city;
          if (city) {
            recipientsQuery = `
              SELECT DISTINCT u.id, u.email, u.first_name, u.last_name
              FROM users u
              JOIN email_subscriptions es ON u.id = es.user_id
              WHERE es.is_subscribed = true 
                AND u.email IS NOT NULL 
                AND u.email != ''
                AND (es.location_city ILIKE $1 OR u.city ILIKE $1)
            `;
            queryParams = [`%${city}%`];
          }
          break;
          
        default:
          throw new Error(`Unknown target audience: ${target_audience}`);
      }
      
      const recipientsResult = await client.query(recipientsQuery, queryParams);
      return recipientsResult.rows;
      
    } finally {
      client.release();
    }
  }

  /**
   * Send email campaign
   */
  static async sendCampaign(campaignId) {
    const client = await pool.connect();
    
    try {
      // Get campaign details
      const campaignResult = await client.query(`
        SELECT ec.*, et.html_content, u.first_name as artist_name, u.email as artist_email
        FROM email_campaigns ec
        JOIN email_templates et ON ec.template_id = et.id
        JOIN users u ON ec.artist_id = u.id
        WHERE ec.id = $1 AND ec.status = 'approved'
      `, [campaignId]);
      
      if (campaignResult.rows.length === 0) {
        throw new Error('Campaign not found or not approved');
      }
      
      const campaign = campaignResult.rows[0];
      const recipients = await EmailService.getCampaignRecipients(campaignId);
      
      if (recipients.length === 0) {
        throw new Error('No recipients found for campaign');
      }

      // Update campaign status to sending
      await client.query(`
        UPDATE email_campaigns 
        SET status = 'sending', total_recipients = $2, sent_at = NOW()
        WHERE id = $1
      `, [campaignId, recipients.length]);

      let emailsSent = 0;
      const batchSize = 10; // Send in batches to avoid rate limits
      
      // Process recipients in batches
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const emailPromises = batch.map(async (recipient) => {
          try {
            // Process template with recipient-specific variables
            const variables = {
              ...JSON.parse(campaign.raw_content || '{}'),
              user_name: `${recipient.first_name} ${recipient.last_name}`.trim(),
              unsubscribe_url: `${process.env.SITE_URL || 'https://artist-events-theta.vercel.app'}/api/email/unsubscribe?user_id=${recipient.id}&campaign_id=${campaignId}`,
              campaign_id: campaignId,
              user_id: recipient.id
            };
            
            const processedContent = EmailService.processTemplate(campaign.html_content, variables);
            
            // Send email via Resend
            const emailResult = await resend.emails.send({
              from: `${campaign.artist_name} <${process.env.FROM_EMAIL || 'notifications@artist-events.com'}>`,
              to: recipient.email,
              subject: campaign.subject,
              html: processedContent,
              reply_to: campaign.artist_email,
              tags: [
                { name: 'campaign_id', value: campaignId.toString() },
                { name: 'user_id', value: recipient.id.toString() }
              ]
            });

            // Record email recipient
            await client.query(`
              INSERT INTO email_recipients (campaign_id, user_id, email, sent_at)
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT (campaign_id, user_id) 
              DO UPDATE SET sent_at = NOW()
            `, [campaignId, recipient.id, recipient.email]);
            
            emailsSent++;
            return { success: true, email: recipient.email };
            
          } catch (error) {
            console.error(`Failed to send email to ${recipient.email}:`, error);
            return { success: false, email: recipient.email, error: error.message };
          }
        });
        
        // Wait for batch to complete
        await Promise.allSettled(emailPromises);
        
        // Rate limiting delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update campaign with final stats
      await client.query(`
        UPDATE email_campaigns 
        SET status = 'sent', emails_sent = $2
        WHERE id = $1
      `, [campaignId, emailsSent]);

      return {
        success: true,
        campaignId,
        totalRecipients: recipients.length,
        emailsSent,
        message: `Campaign sent successfully to ${emailsSent}/${recipients.length} recipients`
      };
      
    } catch (error) {
      // Update campaign status to failed
      await client.query(`
        UPDATE email_campaigns 
        SET status = 'rejected', admin_notes = $2
        WHERE id = $1
      `, [campaignId, `Send failed: ${error.message}`]);
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Track email open
   */
  static async trackOpen(campaignId, userId) {
    const client = await pool.connect();
    
    try {
      // Update recipient tracking
      await client.query(`
        UPDATE email_recipients 
        SET opened_at = COALESCE(opened_at, NOW()),
            open_count = open_count + 1
        WHERE campaign_id = $1 AND user_id = $2
      `, [campaignId, userId]);
      
      // Update campaign stats
      await client.query(`
        UPDATE email_campaigns 
        SET emails_opened = (
          SELECT COUNT(DISTINCT user_id) 
          FROM email_recipients 
          WHERE campaign_id = $1 AND opened_at IS NOT NULL
        )
        WHERE id = $1
      `, [campaignId]);
      
    } finally {
      client.release();
    }
  }

  /**
   * Track email click
   */
  static async trackClick(campaignId, userId, clickedUrl) {
    const client = await pool.connect();
    
    try {
      // Update recipient tracking
      await client.query(`
        UPDATE email_recipients 
        SET clicked_at = COALESCE(clicked_at, NOW()),
            click_count = click_count + 1
        WHERE campaign_id = $1 AND user_id = $2
      `, [campaignId, userId]);
      
      // Update campaign stats
      await client.query(`
        UPDATE email_campaigns 
        SET emails_clicked = (
          SELECT COUNT(DISTINCT user_id) 
          FROM email_recipients 
          WHERE campaign_id = $1 AND clicked_at IS NOT NULL
        )
        WHERE id = $1
      `, [campaignId]);
      
    } finally {
      client.release();
    }
  }

  /**
   * Send individual email (for admin broadcasts and direct sends)
   */
  static async sendEmail({ to, subject, html, from = null, replyTo = null, trackingData = null }) {
    try {
      const senderEmail = from || process.env.FROM_EMAIL || 'onboarding@resend.dev';
      
      const emailOptions = {
        from: senderEmail,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      };
      
      if (replyTo) {
        emailOptions.reply_to = replyTo;
      }
      
      if (trackingData) {
        emailOptions.tags = Object.entries(trackingData).map(([key, value]) => ({
          name: key,
          value: String(value)
        }));
      }
      
      const result = await resend.emails.send(emailOptions);
      
      return {
        success: true,
        messageId: result.data?.id,
        result: result
      };
      
    } catch (error) {
      console.error('Email send error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Handle unsubscribe
   */
  static async unsubscribe(userId, campaignId = null) {
    const client = await pool.connect();
    
    try {
      // Update user subscription status
      await client.query(`
        UPDATE email_subscriptions 
        SET is_subscribed = false, unsubscribed_at = NOW()
        WHERE user_id = $1
      `, [userId]);
      
      if (campaignId) {
        // Track unsubscribe for specific campaign
        await client.query(`
          UPDATE email_recipients 
          SET unsubscribed_at = NOW()
          WHERE campaign_id = $1 AND user_id = $2
        `, [campaignId, userId]);
        
        // Update campaign stats
        await client.query(`
          UPDATE email_campaigns 
          SET unsubscribes = (
            SELECT COUNT(*) 
            FROM email_recipients 
            WHERE campaign_id = $1 AND unsubscribed_at IS NOT NULL
          )
          WHERE id = $1
        `, [campaignId]);
      }
      
      return { success: true, message: 'Successfully unsubscribed' };
      
    } finally {
      client.release();
    }
  }
} 